import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
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

import { useCanEnterApp } from "@/lib/store/auth";
import { supabase } from "@/lib/supabase";
import { useColors, type Palette } from "@/lib/theme";

type Step = "email" | "code";

export default function LoginScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const canEnterApp = useCanEnterApp();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (canEnterApp) {
    return <Redirect href="/week" />;
  }

  async function handleSendCode() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Введите email");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const { error: sendError } = await supabase.auth.signInWithOtp({ email: trimmedEmail });
    setIsSubmitting(false);

    if (sendError) {
      setError(sendError.message);
      return;
    }

    setStep("code");
  }

  async function handleVerifyCode() {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError("Введите код из письма");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: trimmedCode,
      type: "email",
    });
    setIsSubmitting(false);

    if (verifyError) {
      setError(verifyError.message);
    }
  }

  function handleChangeEmail() {
    setStep("email");
    setCode("");
    setError(null);
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>Планировщик</Text>
        <Text style={styles.subtitle}>
          {step === "email" ? "Вход по email" : `Код отправлен на ${email.trim()}`}
        </Text>

        {step === "email" ? (
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        ) : (
          <TextInput
            style={styles.input}
            placeholder="000000"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={styles.button}
          disabled={isSubmitting}
          onPress={step === "email" ? handleSendCode : handleVerifyCode}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>{step === "email" ? "Отправить код" : "Войти"}</Text>
          )}
        </Pressable>

        {step === "code" ? (
          <Pressable onPress={handleChangeEmail}>
            <Text style={styles.linkText}>Изменить email</Text>
          </Pressable>
        ) : null}
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
    marginBottom: 8,
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
  error: {
    color: colors.danger,
    fontSize: 13,
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
  linkText: {
    color: colors.accent,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
});
