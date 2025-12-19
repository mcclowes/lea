// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    'intro',
    'getting-started',
    'cheatsheet',
    {
      type: 'category',
      label: 'Language Reference',
      items: [
        'syntax',
        'builtins',
        'pipelines',
        'concurrency',
      ],
    },
    {
      type: 'category',
      label: 'Developer Guides',
      items: [
        'guides/javascript-developers',
        'guides/python-developers',
      ],
    },
    'faq',
  ],
};

export default sidebars;
