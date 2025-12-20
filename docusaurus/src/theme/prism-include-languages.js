import siteConfig from '@generated/docusaurus.config';
import definePrismLea from './prism-lea';

export default function prismIncludeLanguages(PrismObject) {
  const {
    themeConfig: {prism},
  } = siteConfig;
  const {additionalLanguages} = prism;

  // Add Lea language
  definePrismLea(PrismObject);

  // Globally expose Prism for other language definitions
  globalThis.Prism = PrismObject;

  // Load additional languages from config
  additionalLanguages.forEach((lang) => {
    if (lang === 'lea') return; // Already loaded

    if (lang === 'php') {
      require('prismjs/components/prism-markup-templating');
    }
    require(`prismjs/components/prism-${lang}`);
  });

  delete globalThis.Prism;
}
