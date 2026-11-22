import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  completeGoogleRedirect,
  hasPendingGoogleRedirect,
  signInWithGoogle,
} from "@/lib/auth/google";
import { useCanEnterApp } from "@/lib/store/auth";
import { supabase } from "@/lib/supabase";
import { useColors, type Palette } from "@/lib/theme";

type Mode = "signIn" | "signUp";

const MIN_PASSWORD_LENGTH = 6;

// Ответ Google лежит в адресной строке и после загрузки уже не меняется,
// так что подписываться не на что.
const noopSubscribe = () => () => {};

/**
 * Supabase отдаёт ошибки по-английски. Переводим то, что реально видит
 * пользователь; остальное показываем как есть, чтобы не прятать причину.
 */
function translateAuthError(message: string): string {
  const text = message.toLowerCase();

  if (text.includes("invalid login credentials")) {
    return "Неверный email или пароль.";
  }
  if (text.includes("user already registered") || text.includes("already been registered")) {
    return "Этот email уже зарегистрирован — войдите по паролю.";
  }
  if (text.includes("password should be at least")) {
    return `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов.`;
  }
  if (text.includes("email not confirmed")) {
    return "Email не подтверждён. Отключите подтверждение почты в Supabase (Authentication → Providers → Email) или подтвердите адрес по письму.";
  }
  if (text.includes("signups not allowed") || text.includes("signup is disabled")) {
    return "Регистрация отключена в настройках Supabase (Authentication → enable_signup).";
  }
  if (text.includes("unable to validate email address") || text.includes("invalid format")) {
    return "Email указан неверно.";
  }
  if (text.includes("for security purposes") || text.includes("rate limit")) {
    return "Слишком много попыток подряд. Подождите минуту и попробуйте снова.";
  }
  if (text.includes("failed to fetch") || text.includes("network request failed")) {
    return "Нет связи с сервером Supabase. Проверьте EXPO_PUBLIC_SUPABASE_URL и что база запущена.";
  }
  if (text.includes("provider is not enabled") || text.includes("unsupported provider")) {
    return "Вход через Google не включён в Supabase: Authentication → Providers → Google. Пошаговая настройка — в README.";
  }
  if (text.includes("redirect_uri_mismatch")) {
    return "Google не признал адрес возврата. Добавьте <ваш-supabase-url>/auth/v1/callback в Authorized redirect URIs в Google Cloud Console.";
  }
  if (text.includes("code verifier") || text.includes("bad_oauth_state") || text.includes("flow state")) {
    return "Вход через Google не завершился: ссылка открылась в другом браузере или устарела. Попробуйте ещё раз.";
  }

  return message;
}

export default function LoginScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const canEnterApp = useCanEnterApp();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Вернулись ли мы от Google. В статической сборке страницу отрисовывает
  // сборщик, где адресной строки нет вовсе, поэтому серверный снимок — всегда
  // `false`: иначе разметка сервера разошлась бы с клиентской и React
  // перерисовал бы всё дерево заново, с ошибкой в консоли.
  const hasGoogleRedirect = useSyncExternalStore(
    noopSubscribe,
    hasPendingGoogleRedirect,
    () => false
  );
  const [isGoogleRedirectDone, setIsGoogleRedirectDone] = useState(false);
  const isFinishingGoogle = hasGoogleRedirect && !isGoogleRedirectDone;

  // Веб-возврат от Google: `?code=...` меняем на сессию и убираем из адреса.
  // На телефоне разбирать нечего — там обмен уже сделал signInWithGoogle.
  useEffect(() => {
    let isMounted = true;

    void completeGoogleRedirect().then((result) => {
      if (!isMounted) {
        return;
      }
      setIsGoogleRedirectDone(true);
      if (!result) {
        return;
      }
      if (result.error) {
        setError(translateAuthError(result.error));
      }
      // Ответ Google разобран — убираем его из адреса, чтобы перезагрузка
      // не пыталась обменять сгоревший код. Именно setParams, а не replace:
      // перерисовка экрана заново стёрла бы только что показанную ошибку.
      router.setParams({
        code: undefined,
        state: undefined,
        error: undefined,
        error_code: undefined,
        error_description: undefined,
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (canEnterApp) {
    return <Redirect href="/week" />;
  }

  if (isFinishingGoogle) {
    return (
      <View style={styles.root}>
        <View style={[styles.card, styles.finishingCard]}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.subtitle}>Завершаем вход через Google…</Text>
        </View>
      </View>
    );
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function handleGoogle() {
    setError(null);
    setNotice(null);
    setIsGoogleSubmitting(true);

    const { error: googleError, cancelled } = await signInWithGoogle();

    if (googleError) {
      setIsGoogleSubmitting(false);
      setError(translateAuthError(googleError));
      return;
    }
    if (cancelled || Platform.OS !== "web") {
      // Телефон: сессию положит onAuthStateChange, экран сменится сам.
      setIsGoogleSubmitting(false);
      return;
    }
    // Веб: страница уже уходит на Google — спиннер гасить незачем,
    // иначе кнопка на миг оживёт прямо перед уходом.
  }

  async function handleSubmit() {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Введите email.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов.`);
      return;
    }

    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    if (mode === "signIn") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      setIsSubmitting(false);

      if (signInError) {
        setError(translateAuthError(signInError.message));
      }
      // Успех не обрабатываем: onAuthStateChange положит сессию в стор,
      // и редирект выше уведёт на «Неделю».
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });
    setIsSubmitting(false);

    if (signUpError) {
      setError(translateAuthError(signUpError.message));
      return;
    }

    // Сессия приходит сразу, только если в Supabase выключено подтверждение
    // почты. Если её нет — аккаунт создан, но войти нельзя, пока адрес не
    // подтверждён письмом; об этом честно говорим, а не висим молча.
    if (!data.session) {
      setNotice(
        "Аккаунт создан, но в Supabase включено подтверждение email — войти можно только после письма. Отключите «Confirm email» в Authentication → Providers → Email, затем войдите по паролю."
      );
    }
  }

  const isSignIn = mode === "signIn";

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>Планировщик</Text>
        <Text style={styles.subtitle}>{isSignIn ? "Вход по паролю" : "Регистрация"}</Text>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, isSignIn && styles.tabActive]}
            onPress={() => switchMode("signIn")}
          >
            <Text style={[styles.tabText, isSignIn && styles.tabTextActive]}>Вход</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, !isSignIn && styles.tabActive]}
            onPress={() => switchMode("signUp")}
          >
            <Text style={[styles.tabText, !isSignIn && styles.tabTextActive]}>Регистрация</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="Пароль"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={isSignIn ? "current-password" : "new-password"}
            secureTextEntry={!isPasswordVisible}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
          />
          <Pressable style={styles.peek} onPress={() => setIsPasswordVisible((prev) => !prev)}>
            <Text style={styles.peekText}>{isPasswordVisible ? "Скрыть" : "Показать"}</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Pressable
          style={styles.button}
          disabled={isSubmitting || isGoogleSubmitting}
          onPress={handleSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>{isSignIn ? "Войти" : "Создать аккаунт"}</Text>
          )}
        </Pressable>

        <View style={styles.separator}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>или</Text>
          <View style={styles.separatorLine} />
        </View>

        <Pressable
          style={styles.googleButton}
          disabled={isSubmitting || isGoogleSubmitting}
          onPress={handleGoogle}
        >
          {isGoogleSubmitting ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <>
              <Text style={styles.googleMark}>G</Text>
              <Text style={styles.googleButtonText}>Войти через Google</Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={() => switchMode(isSignIn ? "signUp" : "signIn")}>
          <Text style={styles.linkText}>
            {isSignIn ? "Нет аккаунта? Зарегистрируйтесь" : "Уже есть аккаунт? Войдите"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    card: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      gap: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textMuted,
    },
    finishingCard: {
      alignItems: "center",
      gap: 16,
      paddingVertical: 32,
    },
    tabs: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 4,
    },
    tab: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    tabActive: {
      borderColor: colors.accent,
      backgroundColor: colors.background,
    },
    tabText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textMuted,
    },
    tabTextActive: {
      color: colors.accent,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
    },
    passwordRow: {
      justifyContent: "center",
    },
    passwordInput: {
      paddingRight: 86,
    },
    peek: {
      position: "absolute",
      right: 10,
      paddingHorizontal: 4,
      paddingVertical: 6,
    },
    peekText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "600",
    },
    error: {
      color: colors.danger,
      fontSize: 13,
    },
    notice: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    button: {
      backgroundColor: colors.accent,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 4,
    },
    buttonText: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 15,
    },
    separator: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginVertical: 2,
    },
    separatorLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    separatorText: {
      color: colors.textMuted,
      fontSize: 12,
    },
    googleButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingVertical: 12,
    },
    googleMark: {
      fontSize: 16,
      fontWeight: "700",
      color: "#4285F4",
    },
    googleButtonText: {
      color: colors.text,
      fontWeight: "600",
      fontSize: 15,
    },
    linkText: {
      color: colors.accent,
      fontSize: 13,
      textAlign: "center",
      marginTop: 4,
    },
  });
