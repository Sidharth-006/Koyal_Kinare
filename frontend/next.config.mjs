let backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;
if (!backendUrl || (process.env.NODE_ENV === 'production' && (backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1')))) {
  backendUrl = process.env.NODE_ENV === 'production' ? 'https://koyal-kinare.onrender.com' : 'http://localhost:3000';
}

const nextConfig = {
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  trailingSlash: true,
  reactStrictMode: true,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
