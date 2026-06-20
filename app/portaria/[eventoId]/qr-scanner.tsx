"use client";

import { useEffect, useRef } from "react";

/**
 * Wrapper em volta da lib html5-qrcode. Importada dinamicamente (só no
 * browser) porque mexe com a câmera e não pode rodar no SSR.
 *
 * O scanner fica lendo continuamente; o componente pai é quem decide o que
 * fazer com cada leitura (e ignora repetições enquanto mostra um resultado).
 */
export function QrScanner({
  onResult,
  onError,
}: {
  onResult: (texto: string) => void;
  onError?: (mensagem: string) => void;
}) {
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);

  // Mantém os callbacks atuais sem reiniciar a câmera a cada render.
  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    let cancelado = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let scanner: any = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelado) return;
        scanner = new Html5Qrcode("qr-reader");
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decoded: string) => onResultRef.current(decoded),
          () => {
            /* leitura sem QR no frame — ignorar */
          },
        );
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Não foi possível acessar a câmera.";
        onErrorRef.current?.(msg);
      }
    })();

    return () => {
      cancelado = true;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {
            /* já parado */
          });
      }
    };
  }, []);

  return (
    <div
      id="qr-reader"
      className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-black"
    />
  );
}
