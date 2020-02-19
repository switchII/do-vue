/*
Copyright 2020 DigitalOcean

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fetch = require('node-fetch');
const fs = require('fs');
const ensureDir = require('./ensureDir');

module.exports = async () => {
    console.log('Fetching Community Tools template from www.digitalocean.com...');

    // Fetch raw template
    let rawHTML;

    if (process.env.BLANK_TEMPLATE === 'true') {
        // Support a blank template for completely local dev
        rawHTML = `<!DOCTYPE HTML>
<html lang="en">
    <head>
        <title>Blank Template</title>
    </head>
    <body>
        <div class="wrapper layout-wrapper">
        </div>
    </body>
</html>
`;
    } else if (process.env.WWW_TEMPLATE === 'true') {
        // Support developing a tool for WWW
        const res = await fetch('https://www.digitalocean.com/pricing/calculator');
        rawHTML = await res.text();
    } else {
        // Default to a tool for Community tooling
        const res = await fetch('https://www.digitalocean.com/community/tools/blank');
        rawHTML = await res.text();
    }

    // Parse
    const dom = new JSDOM(rawHTML);
    const { document } = dom.window;
    const nav = document.querySelector('nav.do_nav');

    if (nav) {
        // Nuke top log in button
        nav.querySelectorAll('ul.utility li[role="menuitem"]').forEach(node => {
            if (node.innerHTML.includes('<header>Log in to</header>')) {
                node.remove();
            }
        });

        // Nuke the primary log in button
        nav.querySelectorAll('ul.primary li[role="menuitem"]').forEach(node => {
            if (node.innerHTML.includes('Sign Up</a>')) {
                node.remove();
            }
        });
    }

    // Deal with hard URLs
    document.querySelectorAll('[href]').forEach(node => {
        const href = node.getAttribute('href');
        if (href.startsWith('/')) {
            node.setAttribute('href', `https://www.digitalocean.com${href}`);
        }
    });
    document.querySelectorAll('[src]').forEach(node => {
        const src = node.getAttribute('src');
        if (src.startsWith('/')) {
            node.setAttribute('src', `https://www.digitalocean.com${src}`);
        }
    });
    document.querySelectorAll('[content]').forEach(node => {
        const content = node.getAttribute('content');
        if (content.startsWith('/')) {
            node.setAttribute('content', `https://www.digitalocean.com${content}`);
        }
    });

    // Inject charset
    if (!document.querySelectorAll('meta[charset="utf-8"]') && !document.querySelectorAll('meta[charset="utf8"]')) {
        const charset = document.createElement('meta');
        charset.setAttribute('charset', 'utf-8');
        document.head.insertBefore(charset, document.head.firstChild);
    }

    // Inject content block (for WWW)
    const main = document.querySelector('main.SiteFrame-body');
    if (main) main.innerHTML = '<section class="www-Section www-Section--insetSquish">' +
        '<block name="content"></block></section>';

    // Remove some WWW content we don't need
    document.documentElement.className = '';
    const pricingScript = document.querySelector('script[src*="pricing-calculator"]');
    if (pricingScript) pricingScript.remove();

    // Convert back to raw
    rawHTML = dom.serialize();

    // Inject title block
    rawHTML = rawHTML.replace(/<title>(.+?)<\/title>/, '<title><block name="title"></block>DigitalOcean</title>');

    // Inject head block
    rawHTML = rawHTML.replace('</head>', '<block name="head"></block></head>');

    // Inject content block (for Community)
    rawHTML = rawHTML.replace(/<div class=['"]wrapper layout-wrapper['"]>/,
        '<div class="wrapper layout-wrapper"><block name="content"></block>');

    // Inject last fetch comment
    rawHTML = rawHTML.replace('<head>', `<!-- Last fetch from www.digitalocean.com @ ${(new Date()).toISOString()} -->\n<head>`);

    // Create target directory
    const baseDir = `${process.cwd()}/build`;
    ensureDir(baseDir);

    // Export
    fs.writeFileSync(`${baseDir}/base.html`, rawHTML, { flag: 'w+' });
    console.log('...fetching & conversion completed, saved to build/base.html');
};
