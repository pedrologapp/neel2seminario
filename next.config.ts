import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl
  ? new URL(supabaseUrl).hostname
  : "*.supabase.co";

const nextConfig: NextConfig = {
  experimental: {
    // Folga para o upload da capa do evento (a imagem já é comprimida no
    // navegador antes de enviar, então o normal fica bem abaixo disso).
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async redirects() {
    return [
      // Domínio antigo do 2º Seminário (que o pessoal já conhece): quem cair
      // na raiz de neel2seminario.vercel.app vai direto pra página do evento.
      // O hub geral de eventos fica em eventosneel.vercel.app.
      {
        source: "/",
        has: [{ type: "host", value: "neel2seminario.vercel.app" }],
        destination: "/eventos/2-seminario-espirita-do-neel",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
