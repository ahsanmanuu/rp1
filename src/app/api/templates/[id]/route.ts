import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TEMPLATE_CONTENT } from '@/lib/studio-fs';
import { mapLegacyTemplateId, TEMPLATE_REGISTRY } from '@/lib/templates/registry';
import fs from 'fs';
import path from 'path';

const PREMIUM_PACKAGES = `
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{graphicx}
\\usepackage{booktabs,multirow,array,tabularx}
\\usepackage[export]{adjustbox}
\\usepackage{caption,float}
\\usepackage{url}
\\usepackage{hyperref}
\\graphicspath{{./}{MIGRATION FILES/}}
`;

const BUILTIN_SKELETONS: Record<string, string> = {
  article_ieee: `\\documentclass[journal]{IEEEtran}
${PREMIUM_PACKAGES}
\\usepackage{cite}

\\begin{document}
\\title{Manuscript Title}
\\author{Author Name}

\\IEEEtitleabstractindextext{
\\begin{abstract}
Your migrated abstract will appear here.
\\end{abstract}
\\begin{IEEEkeywords}
Keywords
\\end{IEEEkeywords}
}

\\maketitle

\\section{Introduction}
Introduction placeholder.

\\bibliographystyle{IEEEtran}
\\bibliography{references}
\\end{document}`,

  article_acm: `\\documentclass[sigconf]{acmart}
${PREMIUM_PACKAGES}

\\begin{document}
\\title{Manuscript Title}
\\author{Author Name}
\\affiliation{\\institution{Institution}}

\\begin{abstract}
Your migrated abstract will appear here.
\\end{abstract}

\\keywords{keywords}

\\maketitle

\\section{Introduction}
Introduction placeholder.

\\bibliographystyle{ACM-Reference-Format}
\\bibliography{references}
\\end{document}`,

  article_elsevier: `\\documentclass[preprint,12pt]{elsarticle}
${PREMIUM_PACKAGES}

\\begin{document}
\\begin{frontmatter}
\\title{Manuscript Title}
\\author{Author Name}
\\address{Institution}

\\begin{abstract}
Your migrated abstract will appear here.
\\end{abstract}

\\begin{keyword}
keywords
\\end{keyword}
\\end{frontmatter}

\\section{Introduction}
Introduction placeholder.

\\bibliographystyle{elsarticle-num}
\\bibliography{references}
\\end{document}`,

  article_lncs: `\\documentclass{llncs}
${PREMIUM_PACKAGES}

\\begin{document}
\\title{Manuscript Title}
\\author{Author Name}
\\institute{Institution}
\\maketitle

\\begin{abstract}
Your migrated abstract will appear here.
\\end{abstract}

\\section{Introduction}
Introduction placeholder.

\\bibliographystyle{splncs04}
\\bibliography{references}
\\end{document}`,

  article_scirep: `\\documentclass[fleqn,10pt]{wlscirep}
${PREMIUM_PACKAGES}

\\begin{document}
\\title{Manuscript Title}
\\author[1,*]{Author Name}
\\affil[1]{Institution}
\\maketitle

\\begin{abstract}
Your migrated abstract will appear here.
\\end{abstract}

\\section{Introduction}
Introduction placeholder.

\\bibliographystyle{naturemag}
\\bibliography{references}
\\end{document}`,

  article_mdpi: `\\documentclass[journal,article,submit,moreauthors,pdftex]{mdpi}
${PREMIUM_PACKAGES}

\\begin{document}
\\title{Manuscript Title}
\\author{Author Name}
\\abstract{Your migrated abstract will appear here.}
\\keyword{keywords}
\\maketitle

\\section{Introduction}
Introduction placeholder.

\\end{document}`,

  article_arxiv: `\\documentclass{article}
${PREMIUM_PACKAGES}
\\usepackage{geometry}
\\geometry{a4paper, margin=1in}

\\begin{document}
\\title{Manuscript Title}
\\author{Author Name}
\\date{\\today}
\\maketitle

\\begin{abstract}
Your migrated abstract will appear here.
\\end{abstract}

\\section{Introduction}
Introduction placeholder.

\\bibliographystyle{plain}
\\bibliography{references}
\\end{document}`
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rawId = (await params).id;
    const id = mapLegacyTemplateId(rawId);

    // 1. Check Database first
    const dbTemplate = await prisma.template.findUnique({
      where: { id }
    });

    if (dbTemplate) {
      return NextResponse.json({ 
        id, 
        content: dbTemplate.templateContent,
        clsContent: dbTemplate.clsContent,
        bstContent: dbTemplate.bstContent,
        assetsJson: dbTemplate.assetsJson
      });
    }

    // 2. Check Local File System for Assets
    const registryItem = TEMPLATE_REGISTRY.find(t => t.id === id);
    if (registryItem?.assetFolder) {
      const assetPath = path.join(process.cwd(), 'src', 'assets', 'templates', registryItem.assetFolder);
      
      if (fs.existsSync(assetPath)) {
        const files = fs.readdirSync(assetPath);
        let content = "";
        let clsContent = "";
        let bstContent = "";
        let bibContent = "";
        const assets: { path: string, content: string }[] = [];

        for (const file of files) {
          const filePath = path.join(assetPath, file);
          if (fs.statSync(filePath).isDirectory()) continue;

          const ext = path.extname(file).toLowerCase();
          const isBinary = /^\.(png|jpg|jpeg|gif|pdf|eps|otf|ttf|woff|woff2)$/i.test(ext);
          
          if (isBinary) {
            const binaryData = fs.readFileSync(filePath);
            const base64 = `data:application/octet-stream;base64,${binaryData.toString('base64')}`;
            assets.push({ path: file, content: base64 });
          } else {
            const fileData = fs.readFileSync(filePath, 'utf8');
            assets.push({ path: file, content: fileData });

            // Maintain legacy fields for compatibility
            if (ext === '.tex' && (file.includes('main') || file.includes('template') || !content)) {
              content = fileData;
            } else if (ext === '.cls') {
              clsContent = fileData;
            } else if (ext === '.bst') {
              bstContent = fileData;
            } else if (ext === '.bib') {
              bibContent = fileData;
            }
          }
        }

        if (content || assets.length > 0) {
          return NextResponse.json({ id, content, clsContent, bstContent, bibContent, assets });
        }
      }
    }

    // 3. Check Builtin Skeletons
    const builtinContent = BUILTIN_SKELETONS[id];
    if (builtinContent) {
      return NextResponse.json({ id, content: builtinContent });
    }

    // 4. Fallback to static dictionary (e.g., 'blank')
    const content = TEMPLATE_CONTENT[id];

    if (!content) {
      // Generic fallback for any article_ request
      if (id.startsWith('article_')) {
        return NextResponse.json({ id, content: BUILTIN_SKELETONS.article_arxiv });
      }
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ id, content });
  } catch (error) {
    console.error("Failed to get template:", error);
    return NextResponse.json({ error: "Failed to load template" }, { status: 500 });
  }
}
