/**
 * Build-time generator for the crawlable /how-it-works page: the same article the app shows,
 * as plain HTML with its CSS inlined and schema.org TechArticle data.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { articleHtml } from '../src/article/article';
import { SOURCES, PRESS_SOURCE_IDS } from '../src/data/sources';

function jsonLd(siteUrl: string): string {
  const doc = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'How the Tesla Roadster flies',
    description:
      'A plain-language explanation of the 2026 Tesla Roadster’s underbody suction fans and compressed-air thrusters, and how it drives up a curled ramp, hangs upside down, flips and lands.',
    datePublished: '2026-10-16',
    dateModified: '2026-10-16',
    inLanguage: 'en',
    author: {
      '@type': 'Organization',
      name: 'Tesla Roadster Simulator contributors',
      url: 'https://github.com/eduardmur/tesla-roadster-simulator',
    },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    image: `${siteUrl}og-image.png`,
    mainEntityOfPage: `${siteUrl}how-it-works/`,
    about: { '@type': 'Product', name: 'Tesla Roadster (second generation)', brand: 'Tesla' },
    citation: PRESS_SOURCE_IDS.map((id) => SOURCES[id].url),
  };
  return `<script type="application/ld+json">${JSON.stringify(doc).replace(/</g, '\\u003c')}</script>`;
}

export function renderHowItWorks(html: string, siteUrl: string, root: string): string {
  const css = readFileSync(resolve(root, 'src/article/article.css'), 'utf8');
  return html
    .split('{{site}}')
    .join(siteUrl)
    .replace('<!--STYLE-->', `<style>body{margin:0;background:#fff}${css}</style>`)
    .replace('<!--JSONLD-->', jsonLd(siteUrl))
    .replace('<!--ARTICLE-->', articleHtml({ backLink: '../' }));
}
