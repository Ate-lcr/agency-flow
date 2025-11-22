// postcss.config.js (à la racine du projet, en utilisant la syntaxe ESM)
// On importe les plugins, y compris celui que l'erreur réclame
import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

export default {
  plugins: [
    tailwindcss,
    autoprefixer,
  ],
};
