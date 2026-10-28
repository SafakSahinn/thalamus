import { useEffect } from 'react';
import { useWallpaper } from '../lib/wallpaper';
import './wallpaper.css';

// Arka plan eklentisi: seçili sahneyi ekranın arkasına sabitler. Yarı saydam kenar çubuğu ve sayfa
// görünümü <html data-wall> özniteliğine bağlı CSS ile gelir (wallpaper.css).

export default function Wallpaper() {
  const wall = useWallpaper();

  useEffect(() => {
    if (!wall) return;
    const root = document.documentElement;
    root.dataset.wall = wall.kind;
    if (wall.dark) root.dataset.wallTone = 'dark';
    return () => { delete root.dataset.wall; delete root.dataset.wallTone; };
  }, [wall]);

  if (!wall) return null;
  return <div className="wallpaper" style={{ background: wall.css }} aria-hidden />;
}
