// Выбор PDF и чтение его в base64. На вебе base64 отдаёт сам пикер,
// на телефоне файл читается через expo-file-system.

import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Platform } from "react-native";

export interface PickedPdf {
  name: string;
  base64: string;
}

function stripDataUrl(value: string): string {
  const marker = "base64,";
  const at = value.indexOf(marker);
  return at === -1 ? value : value.slice(at + marker.length);
}

function readBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = () => resolve(stripDataUrl(String(reader.result)));
    reader.readAsDataURL(blob);
  });
}

/** null — пользователь закрыл окно выбора. */
export async function pickPdf(): Promise<PickedPdf | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const name = asset.name || "statement.pdf";

  if (Platform.OS === "web") {
    if (asset.base64) return { name, base64: stripDataUrl(asset.base64) };
    if (asset.file) return { name, base64: await readBlobAsBase64(asset.file) };
    throw new Error("Не удалось прочитать файл в браузере");
  }

  return { name, base64: await new File(asset.uri).base64() };
}
