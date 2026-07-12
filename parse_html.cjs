const fs = require('fs');
let html = fs.readFileSync('scratch.html', 'utf8');

const mapping = {
    'bg-surface-container': 'var(--color-admin-surface-container)',
    'bg-surface-container-highest': 'var(--color-admin-surface-container-highest)',
    'bg-surface-container-low': 'var(--color-admin-surface-container-low)',
    'bg-surface-container-lowest': 'var(--color-admin-surface-container-lowest)',
    'bg-surface-container-high': 'var(--color-admin-surface-container-high)',
    'bg-surface': 'var(--color-admin-surface)',
    'bg-primary-container': 'var(--color-admin-primary-container)',
    'bg-secondary-container': 'var(--color-admin-secondary-container)',
    'bg-tertiary-container': 'var(--color-admin-tertiary-container)',
    'bg-error-container': 'var(--color-admin-error-container)',
    'bg-error': 'var(--color-admin-error)',
    'bg-primary': 'var(--color-admin-primary)',
    'bg-secondary': 'var(--color-admin-secondary)',
    'bg-outline-variant': 'var(--color-admin-outline-variant)',
    'text-on-surface': 'var(--color-admin-on-surface)',
    'text-on-surface-variant': 'var(--color-admin-on-surface-variant)',
    'text-primary': 'var(--color-admin-primary)',
    'text-on-primary-container': 'var(--color-admin-on-primary-container)',
    'text-on-secondary-container': 'var(--color-admin-on-secondary-container)',
    'text-on-tertiary-container': 'var(--color-admin-on-tertiary-container)',
    'text-error': 'var(--color-admin-error)',
    'text-on-error': 'var(--color-admin-on-error)',
    'text-on-error-container': 'var(--color-admin-on-error-container)',
    'text-tertiary': 'var(--color-admin-tertiary)',
    'text-secondary': 'var(--color-admin-secondary)',
    'border-outline-variant': 'var(--color-admin-outline-variant)',
    'border-primary': 'var(--color-admin-primary)',
    'border-error': 'var(--color-admin-error)',
    'border-tertiary': 'var(--color-admin-tertiary)',
    'bg-error-container/20': 'rgba(255, 180, 171, 0.2)',
    'bg-error-container/5': 'rgba(255, 180, 171, 0.05)',
    'bg-error-container/10': 'rgba(255, 180, 171, 0.1)',
    'bg-error-container/50': 'rgba(255, 180, 171, 0.5)',
    'bg-primary-container/20': 'rgba(79, 70, 229, 0.2)',
    'bg-secondary-container/20': 'rgba(49, 49, 192, 0.2)',
    'bg-tertiary-container/20': 'rgba(164, 65, 0, 0.2)',
    'border-tertiary/20': 'rgba(255, 182, 149, 0.2)',
    'border-primary/20': 'rgba(195, 192, 255, 0.2)',
    'border-error/30': 'rgba(255, 180, 171, 0.3)',
    'text-on-surface-variant/80': 'rgba(199, 196, 216, 0.8)',
    'text-error/80': 'rgba(255, 180, 171, 0.8)',
    'bg-surface/80': 'rgba(11, 19, 38, 0.8)',
    'text-green-400': '#4ade80',
    'bg-green-400': '#4ade80'
};

html = html.replace(/class=/g, 'className=');
html = html.replace(/<img(.*?)>/g, '<img$1 />');
html = html.replace(/<input(.*?)>/g, '<input$1 />');
html = html.replace(/<br>/g, '<br />');

html = html.replace(/className="([^"]+)"/g, (match, classStr) => {
    let classes = classStr.split(' ');
    let keptClasses = [];
    let styleObj = {};
    
    classes.forEach(c => {
        let isDark = c.startsWith('dark:');
        let rawClass = isDark ? c.substring(5) : c;
        let isHover = rawClass.startsWith('hover:');
        let rawBase = isHover ? rawClass.substring(6) : rawClass;
        
        if (rawBase.startsWith('p-stack') || rawBase.startsWith('gap-stack') || rawBase.startsWith('mb-stack') || rawBase.startsWith('p-gutter') || rawBase.startsWith('gap-gutter') || rawBase.startsWith('px-gutter') || rawBase.startsWith('p-container-margin')) {
            rawBase = rawBase.replace('stack-sm', '2').replace('stack-md', '4').replace('stack-lg', '6').replace('gutter', '6').replace('container-margin', '8');
            keptClasses.push((isDark ? 'dark:' : '') + (isHover ? 'hover:' : '') + rawBase);
            return;
        }
        
        if (rawBase.startsWith('font-') || rawBase.startsWith('text-headline') || rawBase.startsWith('text-body') || rawBase.startsWith('text-label')) {
            return;
        }
        
        if (mapping[rawBase]) {
            if (!isHover && !isDark) {
                if (rawBase.startsWith('bg-')) styleObj['backgroundColor'] = mapping[rawBase];
                else if (rawBase.startsWith('text-')) styleObj['color'] = mapping[rawBase];
                else if (rawBase.startsWith('border-')) styleObj['borderColor'] = mapping[rawBase];
            } else {
                keptClasses.push(c);
            }
        } else {
            keptClasses.push(c);
        }
    });

    let newClassName = keptClasses.join(' ').replace(/Active:/g, 'active:').trim();
    let res = 'className="' + newClassName + '"';
    if (Object.keys(styleObj).length > 0) {
        res += ' style={{';
        let entries = Object.entries(styleObj);
        entries.forEach(([k, v], idx) => {
            res += ' ' + k + ': "' + v + '"' + (idx < entries.length - 1 ? ',' : '');
        });
        res += ' }}';
    }
    return res;
});

html = html.replace(/style="([^"]+)"/g, (match, styles) => {
    if (styles.includes('font-variation-settings')) return "style={{ fontVariationSettings: '\\'FILL\\' 1' }}";
    if (styles.includes('width: 75%')) return "style={{ width: '75%' }}";
    if (styles.includes('width: 98%')) return "style={{ width: '98%' }}";
    if (styles.includes('width: 15%')) return "style={{ width: '15%' }}";
    if (styles.includes('width: 65%')) return "style={{ width: '65%' }}";
    return match;
});

html = html.replace(/<!--(.*?)-->/g, '{/* $1 */}');

fs.writeFileSync('temp_users.jsx', html);
console.log('JSX Conversion completed successfully');
