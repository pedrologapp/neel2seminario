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
    let iniciando: Promise<unknown> | null = null;

    // (31/10) parar só depois que a câmera terminou de ligar; o stop() da lib
    // lança erro SÍNCRONO quando a câmera não está rodando (sem câmera, ou
    // trocando Entrada/Almoço rápido) — isso derrubava a página inteira.
    const parar = () => {
      try {
        Promise.resolve(scanner?.stop())
          .then(() => scanner?.clear())
          .catch(() => {
            /* já parado */
          });
      } catch {
        /* não estava rodando */
      }
    };

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelado) return;
        scanner = new Html5Qrcode("qr-reader");
        iniciando = scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            aspectRatio: 1,
            // área de leitura sempre quadrada: 75% do lado menor do vídeo
            qrbox: (w: number, h: number) => {
              const lado = Math.floor(Math.min(w, h) * 0.75);
              return { width: lado, height: lado };
            },
          },
          (decoded: string) => onResultRef.current(decoded),
          () => {
            /* leitura sem QR no frame — ignorar */
          },
        );
        await iniciando;
        if (cancelado) parar();
      } catch (e) {
        if (cancelado) return;
        const msg =
          e instanceof Error ? e.message : "Não foi possível acessar a câmera.";
        onErrorRef.current?.(msg);
      }
    })();

    return () => {
      cancelado = true;
      if (iniciando) iniciando.then(parar, () => {});
    };
  }, []);

  // (31/10) o vídeo da câmera vem 4:3/16:9 e esticava o visor num
  // retângulo; a caixa é quadrada e o vídeo preenche cortando as sobras.
  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden bg-black">
      <style>{`
        #qr-reader, #qr-reader > div { position: absolute !important; inset: 0; width: 100% !important; height: 100% !important; }
        #qr-reader video { width: 100% !important; height: 100% !important; object-fit: cover; }
        #qr-shaded-region { display: none !important; }
      `}</style>
      <div id="qr-reader" />
    </div>
  );
}
