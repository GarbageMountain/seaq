import { marked } from 'marked';
import { useMemo } from 'react';
import readme from '../../../core/README.md?raw';

/**
 * The reference docs are the core package README, rendered as-is — one
 * source of truth, so the site can never drift from what ships on npm.
 */
export function Reference() {
  const html = useMemo(() => marked.parse(readme, { async: false }), []);
  return (
    <article
      className="prose prose-gray mx-auto max-w-3xl dark:prose-invert prose-headings:scroll-mt-20 prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-code:before:content-none prose-code:after:content-none"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: rendering our own README from this repo, not user input
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
