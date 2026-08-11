"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { META_PIXEL_ID } from "@/lib/analytics/meta-pixel";

/**
 * Código base do Meta Pixel. Fica no layout público (site de eventos) —
 * admin e portaria não são rastreados.
 *
 * O snippet abaixo é o oficial do Meta, só com o ID injetado.
 */
export function MetaPixel() {
  const pathname = usePathname();
  const primeiraCarga = useRef(true);

  useEffect(() => {
    if (!META_PIXEL_ID) return;
    // O snippet já dispara o PageView da primeira carga. Como ele não roda
    // de novo nas navegações client-side do App Router, marcamos as demais
    // trocas de rota aqui.
    if (primeiraCarga.current) {
      primeiraCarga.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname]);

  if (!META_PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
