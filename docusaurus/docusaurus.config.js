// @ts-check
import { themes as prismThemes } from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Lea',
  tagline: 'A pipe-oriented functional programming language',
  favicon: 'img/favicon.png',

  url: 'https://lea.mcclowes.com',
  baseUrl: '/',

  organizationName: 'mcclowes',
  projectName: 'lea',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/mcclowes/lea/tree/main/docusaurus/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/lea-social-card.png',
      navbar: {
        title: 'Lea',
        logo: {
          alt: 'Lea Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Documentation',
          },
          {
            href: 'https://lea.mcclowes.com/',
            label: 'Try Online',
            position: 'left',
          },
          {
            href: 'https://github.com/mcclowes/lea',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentation',
            items: [
              {
                label: 'Getting Started',
                to: '/docs/getting-started',
              },
              {
                label: 'Syntax Guide',
                to: '/docs/syntax',
              },
              {
                label: 'Built-in Functions',
                to: '/docs/builtins',
              },
            ],
          },
          {
            title: 'Learn',
            items: [
              {
                label: 'For JavaScript Developers',
                to: '/docs/guides/javascript-developers',
              },
              {
                label: 'For Python Developers',
                to: '/docs/guides/python-developers',
              },
              {
                label: 'Cheat Sheet',
                to: '/docs/cheatsheet',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/mcclowes/lea',
              },
              {
                label: 'npm',
                href: 'https://www.npmjs.com/package/lea-lang',
              },
              {
                label: 'Try Online',
                href: 'https://lea.mcclowes.com/',
              },
            ],
          },
        ],
        copyright: `Copyright ${new Date().getFullYear()} Lea. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash'],
      },
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
    }),
};

export default config;
