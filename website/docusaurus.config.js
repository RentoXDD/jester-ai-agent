/* website/docusaurus.config.js */
module.exports = {
  title: 'Jester AI Agent',
  tagline: 'Autonomous AI agent  Jester',
  url: 'https://RentoXDD.github.io',
  baseUrl: '/jester-ai-agent/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/logo.svg',

  organizationName: 'RentoXDD',
  projectName: 'jester-ai-agent',

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
  },

  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          routeBasePath: 'docs',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/RentoXDD/jester-ai-agent/edit/main/website/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'Jester',
      logo: {
        alt: 'Jester Logo',
        src: 'img/logo.svg',
      },
      items: [
        { to: 'docs/intro', label: 'Docs', position: 'left' },
        { to: 'docs/rules', label: 'Rules', position: 'left' },
        { href: 'https://github.com/RentoXDD/jester-ai-agent', label: 'GitHub', position: 'right' },
      ],
    },

    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Intro', to: 'docs/intro' },
            { label: 'Rules', to: 'docs/rules' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'GitHub', href: 'https://github.com/RentoXDD/jester-ai-agent' },
            { label: 'Discussions', href: 'https://github.com/RentoXDD/jester-ai-agent/discussions' },
          ],
        },
      ],
      copyright: ` ${new Date().getFullYear()} Jester AI`,
    },

    prism: {
      additionalLanguages: ['typescript', 'json'],
    },
  },
};
