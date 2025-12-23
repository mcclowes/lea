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

  headTags: [
    {
      tagName: 'meta',
      attributes: {
        name: 'description',
        content: 'Lea is a pipe-oriented functional programming language with a tree-walk interpreter written in TypeScript. Features first-class pipelines, pattern matching, and clean syntax.',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'keywords',
        content: 'lea, programming language, functional programming, pipe operator, typescript, interpreter, pipelines, pattern matching',
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'author',
        content: 'mcclowes',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'canonical',
        href: 'https://lea.mcclowes.com',
      },
    },
  ],

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
      metadata: [
        { name: 'og:type', content: 'website' },
        { name: 'og:site_name', content: 'Lea Programming Language' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Lea - A Pipe-Oriented Functional Programming Language' },
        { name: 'twitter:description', content: 'Lea is a pipe-oriented functional programming language with first-class pipelines and clean syntax.' },
      ],
      navbar: {
        title: 'Lea',
        logo: {
          alt: 'Lea Logo',
          src: 'img/logo.svg',
          srcDark: 'img/logo-dark.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Documentation',
          },
          {
            href: 'https://lea.playground.mcclowes.com/',
            label: 'Playground',
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
                label: 'Playground',
                href: 'https://lea.playground.mcclowes.com/',
              },
            ],
          },
        ],
        copyright: `Copyright ${new Date().getFullYear()} Lea. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'lea'],
      },
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
    }),
};

export default config;
