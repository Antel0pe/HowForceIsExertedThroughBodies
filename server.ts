// Dev/production server. Bun bundles each HTML page (and the scripts and CSS it references) on the fly:
//   bun run dev     -> http://localhost:5173 with hot reload
//   bun run build   -> static site in dist/
import index from './index.html';
import squat from './squat.html';
import bear from './bear.html';

const server = Bun.serve({
  port: Number(process.env.PORT) || 5173,
  routes: { '/': index, '/index.html': index, '/squat': squat, '/squat.html': squat, '/bear': bear, '/bear.html': bear },
  development: process.env.NODE_ENV !== 'production' && { hmr: true, console: true },
});

console.log(`Muscle Force Explorer: ${server.url}  ·  Squat Lab: ${server.url}squat  ·  Bear Run: ${server.url}bear`);
