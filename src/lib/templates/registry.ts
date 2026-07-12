
export interface TemplateMapping {
  // Existing
  abstractEnv?: string;
  keywordsCmd?: string;
  authorStyle?: 'standard' | 'acm' | 'ieee' | 'elsevier' | 'nature' | 'science';
  sectionPrefix?: boolean;
  sectionStyle?: 'starred' | 'numbered';

  // Citation & Bibliography
  citationStyle?: 'numeric' | 'authoryear' | 'superscript';
  bibliographyStyle?: string;         // e.g. 'IEEEtran', 'apalike', 'acm'
  bibEnv?: 'thebibliography' | 'bibtex';

  // Layout
  columnLayout?: 'single' | 'double';
  floatPlacement?: string;            // e.g. '[h]', '[t]', '[!ht]'

  // Math & Algorithms
  algorithmPackage?: 'algorithm2e' | 'algorithmic' | 'algorithmicx';
  equationNumbering?: 'numbered' | 'unnumbered';

  // Supplementary preamble commands
  preambleExtras?: string[];
}

export interface TemplateMetadata {
  id: string;
  label: string;
  icon: string;
  category: 'Journal' | 'Conference' | 'Basic' | 'Thesis' | 'Presentation' | 'Book' | 'CV';
  subCategory?: string;
  desc: string;
  publisher?: string;
  isCustom?: boolean;
  assetFolder?: string;
  fileExtensions?: string[];
  mapping?: TemplateMapping;
}

export const TEMPLATE_REGISTRY: TemplateMetadata[] = [
  { 
    id: 'blank', 
    label: 'Blank Document', 
    icon: '📄', 
    category: 'Basic', 
    desc: 'Minimal article structure',
    publisher: 'Generic'
  , fileExtensions: [".tex"] },
  
  // --- 1. MULTIDISCIPLINARY & GENERAL SCIENCE ---
  { id: 'nature', label: 'Nature', icon: '/assets/logos/nature.png', category: 'Journal', subCategory: 'Multidisciplinary', desc: 'World\'s leading multidisciplinary science journal.', publisher: 'Nature Portfolio', assetFolder: 'nature', fileExtensions: [".tex",".cls",".sty",".bst",".bib"], mapping: { authorStyle: 'nature', abstractEnv: 'abstract', sectionStyle: 'starred', citationStyle: 'superscript', bibliographyStyle: 'naturemag', columnLayout: 'single' } },
  { id: 'science', label: 'Science', icon: '/assets/logos/science.png', category: 'Journal', subCategory: 'Multidisciplinary', desc: 'Global weekly of the AAAS.', publisher: 'AAAS', assetFolder: 'aaas', fileExtensions: [".tex",".bib",".bst",".cls",".sty"], mapping: { authorStyle: 'science', abstractEnv: 'abstract', sectionStyle: 'starred', citationStyle: 'superscript', columnLayout: 'single' } },
  { id: 'pnas', label: 'PNAS', icon: '/assets/logos/science.png', category: 'Journal', subCategory: 'Multidisciplinary', desc: 'Proceedings of the National Academy of Sciences.', publisher: 'NAS', assetFolder: 'pnas', fileExtensions: [".tex",".bst",".cls",".sty",".bib"], mapping: { authorStyle: 'nature', sectionStyle: 'starred', citationStyle: 'numeric', columnLayout: 'single' } },
  { id: 'nature_comms', label: 'Nature Communications', icon: '/assets/logos/nature.png', category: 'Journal', subCategory: 'Multidisciplinary', desc: 'High-quality open access research.', publisher: 'Nature Portfolio', assetFolder: 'nature', fileExtensions: [".tex",".cls",".sty",".bst",".bib"], mapping: { authorStyle: 'nature', sectionStyle: 'starred', citationStyle: 'superscript', columnLayout: 'single' } },
  { id: 'science_adv', label: 'Science Advances', icon: '/assets/logos/science.png', category: 'Journal', subCategory: 'Multidisciplinary', desc: 'Open access journal of the AAAS.', publisher: 'AAAS', assetFolder: 'aaas', fileExtensions: [".tex",".bib",".bst",".cls",".sty"], mapping: { authorStyle: 'science', sectionStyle: 'starred', citationStyle: 'superscript', columnLayout: 'single' } },
  { id: 'scirep', label: 'Scientific Reports', icon: '/assets/logos/nature.png', category: 'Journal', subCategory: 'Multidisciplinary', desc: 'Open access from the Nature portfolio.', publisher: 'Nature Portfolio', assetFolder: 'scirep', fileExtensions: [".sty",".tex",".bst",".bib",".cls"], mapping: { authorStyle: 'nature', keywordsCmd: 'keywords', sectionStyle: 'starred', citationStyle: 'numeric', columnLayout: 'single' } },
  { id: 'plos_one', label: 'PLOS ONE', icon: '🧬', category: 'Journal', subCategory: 'Multidisciplinary', desc: 'Peer-reviewed open access journal.', publisher: 'PLOS', assetFolder: 'plos', fileExtensions: [".tex",".bst",".cls",".sty",".bib"], mapping: { authorStyle: 'standard', citationStyle: 'numeric', columnLayout: 'single' } },
  { id: 'nature_sust', label: 'Nature Sustainability', icon: '/assets/logos/nature.png', category: 'Journal', subCategory: 'Multidisciplinary', desc: 'Research on sustainability science.', publisher: 'Nature Portfolio', assetFolder: 'nature', fileExtensions: [".tex",".cls",".sty",".bst",".bib"], mapping: { authorStyle: 'nature', sectionStyle: 'starred', citationStyle: 'superscript', columnLayout: 'single' } },

  // --- 2. COMPUTER SCIENCE, AI & IT ---
  { id: 'ieee_tpami', label: 'IEEE TPAMI', icon: '/assets/logos/ieee.png', category: 'Journal', subCategory: 'AI & CS', desc: 'Pattern Analysis and Machine Intelligence.', publisher: 'IEEE', assetFolder: 'ieee', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'ieee', keywordsCmd: 'IEEEkeywords', citationStyle: 'numeric', bibliographyStyle: 'IEEEtran', columnLayout: 'double', floatPlacement: '[!ht]', algorithmPackage: 'algorithmicx' } },
  { id: 'jmlr', label: 'JMLR', icon: '🤖', category: 'Journal', subCategory: 'AI & CS', desc: 'Journal of Machine Learning Research.', publisher: 'JMLR', assetFolder: 'jmlr', fileExtensions: [".cls",".sty",".bst",".tex",".bib"], mapping: { citationStyle: 'authoryear', columnLayout: 'single' } },
  { id: 'acm_cacm', label: 'CACM', icon: '/assets/logos/acm.png', category: 'Journal', subCategory: 'AI & CS', desc: 'Communications of the ACM.', publisher: 'ACM', assetFolder: 'acm', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'acm', keywordsCmd: 'keywords', citationStyle: 'numeric', bibliographyStyle: 'acm', columnLayout: 'double', algorithmPackage: 'algorithmicx' } },
  { id: 'ieee_tnnls', label: 'IEEE TNNLS', icon: '/assets/logos/ieee.png', category: 'Journal', subCategory: 'AI & CS', desc: 'Neural Networks and Learning Systems.', publisher: 'IEEE', assetFolder: 'ieee', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'ieee', keywordsCmd: 'IEEEkeywords', citationStyle: 'numeric', bibliographyStyle: 'IEEEtran', columnLayout: 'double', algorithmPackage: 'algorithmicx' } },
  { id: 'acm_tog', label: 'ACM TOG', icon: '/assets/logos/acm.png', category: 'Journal', subCategory: 'AI & CS', desc: 'ACM Transactions on Graphics.', publisher: 'ACM', assetFolder: 'acm', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'acm', citationStyle: 'numeric', bibliographyStyle: 'acm', columnLayout: 'double' } },
  { id: 'elsevier_ai', label: 'Artificial Intelligence', icon: '/assets/logos/elsevier.png', category: 'Journal', subCategory: 'AI & CS', desc: 'Premier AI journal from Elsevier.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'elsevier', keywordsCmd: 'keyword', citationStyle: 'numeric', bibliographyStyle: 'elsarticle-num', columnLayout: 'single', algorithmPackage: 'algorithmicx' } },
  { id: 'elsevier_nn', label: 'Neural Networks', icon: '/assets/logos/elsevier.png', category: 'Journal', subCategory: 'AI & CS', desc: 'The official journal of the INNS.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'elsevier', citationStyle: 'numeric', bibliographyStyle: 'elsarticle-num', columnLayout: 'single' } },
  { id: 'ieee_tkde', label: 'IEEE TKDE', icon: '/assets/logos/ieee.png', category: 'Journal', subCategory: 'AI & CS', desc: 'Knowledge and Data Engineering.', publisher: 'IEEE', assetFolder: 'ieee', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'ieee', keywordsCmd: 'IEEEkeywords', citationStyle: 'numeric', bibliographyStyle: 'IEEEtran', columnLayout: 'double' } },
  { id: 'ieee_iot', label: 'IEEE Internet of Things', icon: '/assets/logos/ieee.png', category: 'Journal', subCategory: 'AI & CS', desc: 'The IoT Journal of IEEE.', publisher: 'IEEE', assetFolder: 'ieee', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'ieee', keywordsCmd: 'IEEEkeywords', citationStyle: 'numeric', bibliographyStyle: 'IEEEtran', columnLayout: 'double' } },
  { id: 'acm_toms', label: 'ACM TOMS', icon: '/assets/logos/acm.png', category: 'Journal', subCategory: 'AI & CS', desc: 'Transactions on Mathematical Software.', publisher: 'ACM', assetFolder: 'acm', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'springer_ml', label: 'Machine Learning', icon: '/assets/logos/springer.png', category: 'Journal', subCategory: 'AI & CS', desc: 'Springer Machine Learning journal.', publisher: 'Springer', assetFolder: 'springer', fileExtensions: [".cls",".sty",".tex",".bib",".bst"] },
  { id: 'elsevier_eswa', label: 'Expert Systems', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'AI & CS', desc: 'Expert Systems with Applications.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'elsevier_nc', label: 'Neurocomputing', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'AI & CS', desc: 'Elsevier Neurocomputing Journal.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'elsevier_kbs', label: 'Knowledge-Based Systems', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'AI & CS', desc: 'Knowledge-Based Systems journal.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'ieee_tfs', label: 'IEEE Fuzzy Systems', icon: 'https://brand.ieee.org/wp-content/uploads/2021/04/ieee-logo.png', category: 'Journal', subCategory: 'AI & CS', desc: 'Transactions on Fuzzy Systems.', publisher: 'IEEE', assetFolder: 'ieee', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'ieee', keywordsCmd: 'IEEEkeywords', citationStyle: 'numeric', bibliographyStyle: 'IEEEtran', columnLayout: 'double' } },

  // --- 3. ENGINEERING & ROBOTICS ---
  { id: 'ieee_tac', label: 'IEEE TAC', icon: 'https://brand.ieee.org/wp-content/uploads/2021/04/ieee-logo.png', category: 'Journal', subCategory: 'Engineering', desc: 'Transactions on Automatic Control.', publisher: 'IEEE', assetFolder: 'ieee', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'ieee', keywordsCmd: 'IEEEkeywords', citationStyle: 'numeric', bibliographyStyle: 'IEEEtran', columnLayout: 'double' } },
  { id: 'ieee_tro', label: 'IEEE Robotics', icon: 'https://brand.ieee.org/wp-content/uploads/2021/04/ieee-logo.png', category: 'Journal', subCategory: 'Engineering', desc: 'Transactions on Robotics.', publisher: 'IEEE', assetFolder: 'ieee', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'ieee', keywordsCmd: 'IEEEkeywords', citationStyle: 'numeric', bibliographyStyle: 'IEEEtran', columnLayout: 'double' } },
  { id: 'elsevier_auto', label: 'Automatica', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'Engineering', desc: 'The journal of IFAC.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'ieee_tsg', label: 'IEEE Smart Grid', icon: 'https://brand.ieee.org/wp-content/uploads/2021/04/ieee-logo.png', category: 'Journal', subCategory: 'Engineering', desc: 'Transactions on Smart Grid.', publisher: 'IEEE', assetFolder: 'ieee', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'ieee', keywordsCmd: 'IEEEkeywords', citationStyle: 'numeric', bibliographyStyle: 'IEEEtran', columnLayout: 'double' } },
  { id: 'ieee_tsp', label: 'IEEE Signal Proc.', icon: 'https://brand.ieee.org/wp-content/uploads/2021/04/ieee-logo.png', category: 'Journal', subCategory: 'Engineering', desc: 'Transactions on Signal Processing.', publisher: 'IEEE', assetFolder: 'ieee', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'ieee', keywordsCmd: 'IEEEkeywords', citationStyle: 'numeric', bibliographyStyle: 'IEEEtran', columnLayout: 'double' } },
  { id: 'cambridge_jfm', label: 'Journal Fluid Mech.', icon: 'https://www.cambridge.org/core/themes/cup/img/cup-logo.png', category: 'Journal', subCategory: 'Engineering', desc: 'Cambridge Fluid Mechanics.', publisher: 'Cambridge', assetFolder: 'cambridge', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'ieee_twc', label: 'IEEE Wireless Comm.', icon: 'https://brand.ieee.org/wp-content/uploads/2021/04/ieee-logo.png', category: 'Journal', subCategory: 'Engineering', desc: 'Wireless Communications.', publisher: 'IEEE', assetFolder: 'ieee', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'ieee', keywordsCmd: 'IEEEkeywords', citationStyle: 'numeric', bibliographyStyle: 'IEEEtran', columnLayout: 'double' } },
  { id: 'ieee_jsac', label: 'IEEE JSAC', icon: 'https://brand.ieee.org/wp-content/uploads/2021/04/ieee-logo.png', category: 'Journal', subCategory: 'Engineering', desc: 'Areas in Communications.', publisher: 'IEEE', assetFolder: 'ieee', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'ieee', keywordsCmd: 'IEEEkeywords', citationStyle: 'numeric', bibliographyStyle: 'IEEEtran', columnLayout: 'double' } },
  { id: 'wiley_am', label: 'Advanced Materials', icon: 'https://onlinelibrary.wiley.com/favicon.ico', category: 'Journal', subCategory: 'Engineering', desc: 'High impact materials science.', publisher: 'Wiley', assetFolder: 'wiley', fileExtensions: [".tex",".bib",".cls",".sty",".bst"] },
  { id: 'elsevier_ress', label: 'Reliability Eng.', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'Engineering', desc: 'System Safety & Reliability.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'elsevier_asc', label: 'Soft Computing', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'Engineering', desc: 'Applied Soft Computing.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'ieee_csm', label: 'IEEE Control Systems', icon: 'https://brand.ieee.org/wp-content/uploads/2021/04/ieee-logo.png', category: 'Journal', subCategory: 'Engineering', desc: 'IEEE Control Systems Magazine.', publisher: 'IEEE', assetFolder: 'ieee', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'ieee', keywordsCmd: 'IEEEkeywords', citationStyle: 'numeric', bibliographyStyle: 'IEEEtran', columnLayout: 'double' } },
  { id: 'elsevier_jsv', label: 'Sound & Vibration', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'Engineering', desc: 'Journal of Sound and Vibration.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'elsevier_cmame', label: 'Computer Methods', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'Engineering', desc: 'Applied Mechanics and Engineering.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },

  // --- 4. PHYSICS & ASTRONOMY ---
  { id: 'aps_prl', label: 'Physical Review Lett.', icon: 'https://journals.aps.org/files/aps-logo.png', category: 'Journal', subCategory: 'Physics', desc: 'Premier physics letters journal.', publisher: 'APS', assetFolder: 'aps', fileExtensions: [".bst",".tex",".cls",".sty",".bib"] },
  { id: 'nature_physics', label: 'Nature Physics', icon: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Nature_Publishing_Group_logo.svg', category: 'Journal', subCategory: 'Physics', desc: 'High-quality physics research.', publisher: 'Nature Portfolio', assetFolder: 'nature', fileExtensions: [".tex",".cls",".sty",".bst",".bib"] },
  { id: 'aps_rmp', label: 'Rev. Modern Physics', icon: 'https://journals.aps.org/files/aps-logo.png', category: 'Journal', subCategory: 'Physics', desc: 'Major physics reviews.', publisher: 'APS', assetFolder: 'aps', fileExtensions: [".bst",".tex",".cls",".sty",".bib"] },
  { id: 'aas_apj', label: 'Astrophysical Journal', icon: 'https://journals.aas.org/wp-content/themes/aas/img/aas-logo.png', category: 'Journal', subCategory: 'Physics', desc: 'The Astrophysical Journal.', publisher: 'AAS', assetFolder: 'aas', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'ras_mnras', label: 'MNRAS', icon: '🏛️', category: 'Journal', subCategory: 'Physics', desc: 'Royal Astronomical Society.', publisher: 'Oxford', assetFolder: 'oxford', fileExtensions: [".tex",".bst",".cls",".sty",".bib"] },
  { id: 'springer_jhep', label: 'JHEP', icon: 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Springer_Nature_Logo.svg', category: 'Journal', subCategory: 'Physics', desc: 'High Energy Physics journal.', publisher: 'Springer', assetFolder: 'springer', fileExtensions: [".cls",".sty",".tex",".bib",".bst"] },
  { id: 'aps_pra', label: 'Physical Review A-E', icon: 'https://journals.aps.org/files/aps-logo.png', category: 'Journal', subCategory: 'Physics', desc: 'APS Core Physics Series.', publisher: 'APS', assetFolder: 'aps', fileExtensions: [".bst",".tex",".cls",".sty",".bib"] },
  { id: 'edps_aa', label: 'Astronomy & Astrophys.', icon: '🌌', category: 'Journal', subCategory: 'Physics', desc: 'A&A Journal.', publisher: 'EDP Sciences', assetFolder: 'edp', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'elsevier_npb', label: 'Nuclear Physics B', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'Physics', desc: 'Nuclear and Particle Physics.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'elsevier_plb', label: 'Physics Letters B', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'Physics', desc: 'High energy and nuclear physics.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'aip_apl', label: 'Applied Phys. Lett.', icon: 'https://publishing.aip.org/wp-content/themes/aip-publishing/images/aip-publishing-logo.png', category: 'Journal', subCategory: 'Physics', desc: 'Applied Physics Letters.', publisher: 'AIP', assetFolder: 'aip', fileExtensions: [".cls",".sty",".bst",".tex",".bib"] },
  { id: 'aip_jcp', label: 'Journal Chem. Phys.', icon: 'https://publishing.aip.org/wp-content/themes/aip-publishing/images/aip-publishing-logo.png', category: 'Journal', subCategory: 'Physics', desc: 'Chemical Physics journal.', publisher: 'AIP', assetFolder: 'aip', fileExtensions: [".cls",".sty",".bst",".tex",".bib"] },
  { id: 'iop_jcap', label: 'JCAP', icon: 'https://iopscience.iop.org/img/iop-logo.png', category: 'Journal', subCategory: 'Physics', desc: 'Cosmology and Astroparticle Physics.', publisher: 'IOP', assetFolder: 'iop', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'elsevier_ppnp', label: 'Particle & Nuclear', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'Physics', desc: 'Progress in Physics.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'springer_solar', label: 'Solar Physics', icon: 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Springer_Nature_Logo.svg', category: 'Journal', subCategory: 'Physics', desc: 'Springer Solar Physics.', publisher: 'Springer', assetFolder: 'springer', fileExtensions: [".cls",".sty",".tex",".bib",".bst"] },

  // --- 5. MATHEMATICS & STATISTICS ---
  { id: 'princeton_annals', label: 'Annals of Mathematics', icon: '🏛️', category: 'Journal', subCategory: 'Mathematics', desc: 'The most prestigious math journal.', publisher: 'Princeton', assetFolder: 'math', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'jams', label: 'Journal of AMS', icon: 'https://www.ams.org/favicon.ico', category: 'Journal', subCategory: 'Mathematics', desc: 'Official journal of the AMS.', publisher: 'AMS', assetFolder: 'ams', fileExtensions: [".cls",".sty",".bst",".tex",".bib"] },
  { id: 'springer_invent', label: 'Inventiones Math.', icon: 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Springer_Nature_Logo.svg', category: 'Journal', subCategory: 'Mathematics', desc: 'Top tier math research.', publisher: 'Springer', assetFolder: 'springer', fileExtensions: [".cls",".sty",".tex",".bib",".bst"] },
  { id: 'siam_review', label: 'SIAM Review', icon: 'https://www.siam.org/images/SIAM-logo-footer.png', category: 'Journal', subCategory: 'Mathematics', desc: 'Major reviews in applied math.', publisher: 'SIAM', assetFolder: 'siam', fileExtensions: [".tex",".bib",".bst",".cls",".sty"] },
  { id: 'siam_numan', label: 'SIAM Numerical Anal.', icon: 'https://www.siam.org/images/SIAM-logo-footer.png', category: 'Journal', subCategory: 'Mathematics', desc: 'Numerical Analysis Journal.', publisher: 'SIAM', assetFolder: 'siam', fileExtensions: [".tex",".bib",".bst",".cls",".sty"] },
  { id: 'siam_opt', label: 'SIAM Optimization', icon: 'https://www.siam.org/images/SIAM-logo-footer.png', category: 'Journal', subCategory: 'Mathematics', desc: 'Optimization research.', publisher: 'SIAM', assetFolder: 'siam', fileExtensions: [".tex",".bib",".bst",".cls",".sty"] },
  { id: 'ims_annals_stat', label: 'Annals of Statistics', icon: '📊', category: 'Journal', subCategory: 'Mathematics', desc: 'Top tier statistics journal.', publisher: 'IMS', assetFolder: 'ims', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'jrss', label: 'JRSS (Series B)', icon: '📈', category: 'Journal', subCategory: 'Mathematics', desc: 'Royal Statistical Society.', publisher: 'Wiley', assetFolder: 'wiley', fileExtensions: [".tex",".bib",".cls",".sty",".bst"] },
  { id: 'oxford_biometrika', label: 'Biometrika', icon: '🧬', category: 'Journal', subCategory: 'Mathematics', desc: 'Oxford Biometrika journal.', publisher: 'Oxford', assetFolder: 'oxford', fileExtensions: [".tex",".bst",".cls",".sty",".bib"] },
  { id: 'elsevier_jcp_math', label: 'Computational Phys.', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'Mathematics', desc: 'Computational Physics.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'springer_mp', label: 'Math Programming', icon: 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Springer_Nature_Logo.svg', category: 'Journal', subCategory: 'Mathematics', desc: 'Mathematical Programming.', publisher: 'Springer', assetFolder: 'springer', fileExtensions: [".cls",".sty",".tex",".bib",".bst"] },
  { id: 'elsevier_jfa', label: 'Functional Analysis', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'Mathematics', desc: 'Journal of Functional Analysis.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'elsevier_dm', label: 'Discrete Mathematics', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'Mathematics', desc: 'Discrete Math research.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'elsevier_jalgebra', label: 'Journal of Algebra', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'Mathematics', desc: 'Pure Algebra research.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'cambridge_an', label: 'Acta Numerica', icon: 'https://www.cambridge.org/core/themes/cup/img/cup-logo.png', category: 'Journal', subCategory: 'Mathematics', desc: 'Numerical Analysis Reviews.', publisher: 'Cambridge', assetFolder: 'cambridge', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'siam_sisc', label: 'SIAM Sci. Computing', icon: 'https://www.siam.org/images/SIAM-logo-footer.png', category: 'Journal', subCategory: 'Mathematics', desc: 'Scientific Computing.', publisher: 'SIAM', assetFolder: 'siam', fileExtensions: [".tex",".bib",".bst",".cls",".sty"] },

  // --- 6. CHEMISTRY & MATERIALS SCIENCE ---
  { id: 'acs_jacs', label: 'JACS', icon: 'https://pubs.acs.org/pb-assets/images/logos/acs-logo.svg', category: 'Journal', subCategory: 'Chemistry', desc: 'American Chemical Society.', publisher: 'ACS', assetFolder: 'acs', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'wiley_acie', label: 'Angewandte Chemie', icon: 'https://onlinelibrary.wiley.com/favicon.ico', category: 'Journal', subCategory: 'Chemistry', desc: 'International Edition.', publisher: 'Wiley', assetFolder: 'wiley', fileExtensions: [".tex",".bib",".cls",".sty",".bst"] },
  { id: 'rsc_chemsci', label: 'Chemical Science', icon: '🧪', category: 'Journal', subCategory: 'Chemistry', desc: 'Royal Society of Chemistry.', publisher: 'RSC', assetFolder: 'rsc', fileExtensions: [".tex",".bst",".cls",".sty",".bib"] },
  { id: 'nature_chem', label: 'Nature Chemistry', icon: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Nature_Publishing_Group_logo.svg', category: 'Journal', subCategory: 'Chemistry', desc: 'Top tier chemistry.', publisher: 'Nature Portfolio', assetFolder: 'nature', fileExtensions: [".tex",".cls",".sty",".bst",".bib"] },
  { id: 'wiley_afm', label: 'Adv. Functional Mat.', icon: 'https://onlinelibrary.wiley.com/favicon.ico', category: 'Journal', subCategory: 'Chemistry', desc: 'Functional materials.', publisher: 'Wiley', assetFolder: 'wiley', fileExtensions: [".tex",".bib",".cls",".sty",".bst"] },
  { id: 'acs_jpcl', label: 'Phys. Chem. Letters', icon: 'https://pubs.acs.org/pb-assets/images/logos/acs-logo.svg', category: 'Journal', subCategory: 'Chemistry', desc: 'Physical Chemistry.', publisher: 'ACS', assetFolder: 'acs', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'acs_nano', label: 'ACS Nano', icon: 'https://pubs.acs.org/pb-assets/images/logos/acs-logo.svg', category: 'Journal', subCategory: 'Chemistry', desc: 'Nanoscience and nanotechnology.', publisher: 'ACS', assetFolder: 'acs', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'rsc_pccp', label: 'PCCP', icon: '🧪', category: 'Journal', subCategory: 'Chemistry', desc: 'Physical Chemistry Chem. Phys.', publisher: 'RSC', assetFolder: 'rsc', fileExtensions: [".tex",".bst",".cls",".sty",".bib"] },
  { id: 'acs_nano_lett', label: 'Nano Letters', icon: 'https://pubs.acs.org/pb-assets/images/logos/acs-logo.svg', category: 'Journal', subCategory: 'Chemistry', desc: 'Nano research letters.', publisher: 'ACS', assetFolder: 'acs', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'rsc_jmca', label: 'J. Materials Chem. A', icon: '🧪', category: 'Journal', subCategory: 'Chemistry', desc: 'Materials for energy.', publisher: 'RSC', assetFolder: 'rsc', fileExtensions: [".tex",".bst",".cls",".sty",".bib"] },

  // --- 7. ECONOMICS & SOCIAL SCIENCES ---
  { id: 'econometrica', label: 'Econometrica', icon: '📊', category: 'Journal', subCategory: 'Economics', desc: 'The Econometric Society.', publisher: 'Wiley', assetFolder: 'wiley', fileExtensions: [".tex",".bib",".cls",".sty",".bst"] },
  { id: 'oxford_qje', label: 'QJE', icon: '📈', category: 'Journal', subCategory: 'Economics', desc: 'Quarterly Journal of Econ.', publisher: 'Oxford', assetFolder: 'oxford', fileExtensions: [".tex",".bst",".cls",".sty",".bib"] },
  { id: 'chicago_jpe', label: 'Political Economy', icon: '🏛️', category: 'Journal', subCategory: 'Economics', desc: 'Journal of Political Economy.', publisher: 'Chicago', assetFolder: 'chicago', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'oxford_res', label: 'Review Econ. Studies', icon: '📉', category: 'Journal', subCategory: 'Economics', desc: 'REStud.', publisher: 'Oxford', assetFolder: 'oxford', fileExtensions: [".tex",".bst",".cls",".sty",".bib"] },
  { id: 'elsevier_jet', label: 'Economic Theory', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'Economics', desc: 'Journal of Economic Theory.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'elsevier_geb', label: 'Games & Behavior', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'Economics', desc: 'Games and Economic Behavior.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'elsevier_jfe', label: 'Financial Econ.', icon: 'https://www.elsevier.com/__data/assets/image/0009/101889/elsevier-logo-white-on-orange.png', category: 'Journal', subCategory: 'Economics', desc: 'Journal of Financial Econ.', publisher: 'Elsevier', assetFolder: 'elsevier', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'informs_ms', label: 'Management Science', icon: '📋', category: 'Journal', subCategory: 'Economics', desc: 'INFORMS Management Science.', publisher: 'INFORMS', assetFolder: 'informs', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'informs_or', label: 'Operations Research', icon: '⚙️', category: 'Journal', subCategory: 'Economics', desc: 'INFORMS Operations Research.', publisher: 'INFORMS', assetFolder: 'informs', fileExtensions: [".bst",".cls",".sty",".tex",".bib"] },
  { id: 'wiley_mf', label: 'Mathematical Finance', icon: '🧮', category: 'Journal', subCategory: 'Economics', desc: 'Wiley Math Finance.', publisher: 'Wiley', assetFolder: 'wiley', fileExtensions: [".tex",".bib",".cls",".sty",".bst"] },

  // --- 8. LIFE SCIENCES, BIOLOGY & MEDICINE ---
  { id: 'nature_biotech', label: 'Nature Biotech', icon: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Nature_Publishing_Group_logo.svg', category: 'Journal', subCategory: 'Life Sciences', desc: 'Biotechnology research.', publisher: 'Nature Portfolio', assetFolder: 'nature', fileExtensions: [".tex",".cls",".sty",".bst",".bib"] },
  { id: 'nature_med', label: 'Nature Medicine', icon: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Nature_Publishing_Group_logo.svg', category: 'Journal', subCategory: 'Life Sciences', desc: 'Biomedical research.', publisher: 'Nature Portfolio', assetFolder: 'nature', fileExtensions: [".tex",".cls",".sty",".bst",".bib"] },
  { id: 'nature_meth', label: 'Nature Methods', icon: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Nature_Publishing_Group_logo.svg', category: 'Journal', subCategory: 'Life Sciences', desc: 'New techniques in life sciences.', publisher: 'Nature Portfolio', assetFolder: 'nature', fileExtensions: [".tex",".cls",".sty",".bst",".bib"] },
  { id: 'oxford_bioinfo', label: 'Bioinformatics', icon: '🧬', category: 'Journal', subCategory: 'Life Sciences', desc: 'Bioinformatics and biology.', publisher: 'Oxford', assetFolder: 'oxford', fileExtensions: [".tex",".bst",".cls",".sty",".bib"] },
  { id: 'plos_comp_bio', label: 'PLOS Comp. Bio.', icon: 'https://journals.plos.org/plosone/static/img/logo.png', category: 'Journal', subCategory: 'Life Sciences', desc: 'Computational biology.', publisher: 'PLOS', assetFolder: 'plos', fileExtensions: [".tex",".bst",".cls",".sty",".bib"] },
  { id: 'springer_bmc', label: 'BMC Bioinformatics', icon: 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Springer_Nature_Logo.svg', category: 'Journal', subCategory: 'Life Sciences', desc: 'Open access bioinformatics.', publisher: 'Springer', assetFolder: 'springer', fileExtensions: [".cls",".sty",".tex",".bib",".bst"] },
  { id: 'oxford_nar', label: 'Nucleic Acids Res.', icon: '🧬', category: 'Journal', subCategory: 'Life Sciences', desc: 'Oxford NAR.', publisher: 'Oxford', assetFolder: 'oxford', fileExtensions: [".tex",".bst",".cls",".sty",".bib"] },

  // --- THESIS & UNIVERSITIES ---
  { id: 'thesis_mit', label: 'MIT Dissertation', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/MIT_logo.svg', category: 'Thesis', subCategory: 'Global', desc: 'Official MIT graduate thesis.', publisher: 'MIT', assetFolder: 'thesis', fileExtensions: [".tex",".bst",".bib",".cls",".sty"] },
  { id: 'thesis_stanford', label: 'Stanford Thesis', icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Stanford_University_logo.svg', category: 'Thesis', subCategory: 'Global', desc: 'Standard Stanford dissertation.', publisher: 'Stanford', assetFolder: 'thesis', fileExtensions: [".tex",".bst",".bib",".cls",".sty"] },
  { id: 'thesis_oxford', label: 'Oxford OCIAM', icon: '🏛️', category: 'Thesis', subCategory: 'Global', desc: 'Oxford Mathematical Institute.', publisher: 'Oxford', assetFolder: 'thesis', fileExtensions: [".tex",".bst",".bib",".cls",".sty"] },
  { id: 'thesis_cambridge', label: 'Cambridge PhD', icon: '🎓', category: 'Thesis', subCategory: 'Global', desc: 'University of Cambridge PhD.', publisher: 'Cambridge', assetFolder: 'thesis', fileExtensions: [".tex",".bst",".bib",".cls",".sty"] },
  { id: 'thesis_iitd', label: 'IIT Delhi Thesis', icon: '🇮🇳', category: 'Thesis', subCategory: 'India', desc: 'Standard IIT Delhi dissertation.', publisher: 'IIT Delhi', assetFolder: 'thesis', fileExtensions: [".tex",".bst",".bib",".cls",".sty"] },
  { id: 'thesis_iitb', label: 'IIT Bombay Thesis', icon: '🇮🇳', category: 'Thesis', subCategory: 'India', desc: 'Official IIT Bombay format.', publisher: 'IIT Bombay', assetFolder: 'thesis', fileExtensions: [".tex",".bst",".bib",".cls",".sty"] },
  { id: 'thesis_iisc', label: 'IISc PhD Thesis', icon: '🧬', category: 'Thesis', subCategory: 'India', desc: 'IISc Bangalore thesis layout.', publisher: 'IISc Bangalore', assetFolder: 'thesis', fileExtensions: [".tex",".bst",".bib",".cls",".sty"] },
  { id: 'thesis_jnu', label: 'JNU Thesis', icon: '🇮🇳', category: 'Thesis', subCategory: 'India', desc: 'Jawaharlal Nehru University.', publisher: 'JNU', assetFolder: 'thesis', fileExtensions: [".tex",".bst",".bib",".cls",".sty"] },
  { id: 'thesis_du', label: 'Delhi Univ Thesis', icon: '🇮🇳', category: 'Thesis', subCategory: 'India', desc: 'University of Delhi.', publisher: 'DU', assetFolder: 'thesis', fileExtensions: [".tex",".bst",".bib",".cls",".sty"] },

  // --- CV & RESUMES ---
  { id: 'cv_academic_harvard', label: 'Harvard CV', icon: '📋', category: 'CV', subCategory: 'Academic', desc: 'Classic Harvard CV style.', publisher: 'Harvard', assetFolder: 'cv', fileExtensions: [".cls",".sty",".tex",".bst",".bib"] },
  { id: 'cv_yale', label: 'Yale Resume', icon: '💼', category: 'CV', subCategory: 'Professional', desc: 'Yale SOM professional resume.', publisher: 'Yale', assetFolder: 'cv', fileExtensions: [".cls",".sty",".tex",".bst",".bib"] },
  { id: 'cv_iit_placement', label: 'IIT Placement CV', icon: '🇮🇳', category: 'CV', subCategory: 'Professional', desc: 'The 1-page IIT standard.', publisher: 'IITs', assetFolder: 'cv', fileExtensions: [".cls",".sty",".tex",".bst",".bib"] },
  { id: 'cv_overleaf_modern', label: 'Modern CV', icon: '✨', category: 'CV', subCategory: 'Designer', desc: 'Stylish Overleaf template.', publisher: 'Community', assetFolder: 'cv', fileExtensions: [".cls",".sty",".tex",".bst",".bib"] },

  // --- CONFERENCE TEMPLATES ---
  { id: 'conf_ieee', label: 'IEEE Conference', icon: '/assets/logos/ieee.png', category: 'Conference', subCategory: 'Engineering', desc: 'Standard IEEE 2-column conference format.', publisher: 'IEEE', assetFolder: 'ieee_conf', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'ieee', keywordsCmd: 'IEEEkeywords', citationStyle: 'numeric', bibliographyStyle: 'IEEEtran', columnLayout: 'double', floatPlacement: '[!ht]', algorithmPackage: 'algorithmicx' } },
  { id: 'conf_acm', label: 'ACM SIGCONF', icon: 'https://www.acm.org/images/acm_logo_tablet.png', category: 'Conference', subCategory: 'CS', desc: 'Standard ACM Proceedings (sigconf).', publisher: 'ACM', assetFolder: 'acm_conf', fileExtensions: [".bst",".cls",".sty",".tex",".bib"], mapping: { authorStyle: 'acm', keywordsCmd: 'keywords', citationStyle: 'numeric', bibliographyStyle: 'acm', columnLayout: 'double', algorithmPackage: 'algorithmicx' } },
  { id: 'conf_neurips', label: 'NeurIPS', icon: '🧠', category: 'Conference', subCategory: 'AI', desc: 'Neural Information Processing Systems format.', publisher: 'NeurIPS', assetFolder: 'neurips', fileExtensions: [".tex",".sty",".bib",".bst"], mapping: { authorStyle: 'nature', citationStyle: 'numeric', columnLayout: 'single', algorithmPackage: 'algorithmicx' } },
  { id: 'conf_icml', label: 'ICML', icon: '🤖', category: 'Conference', subCategory: 'AI', desc: 'International Conference on Machine Learning.', publisher: 'ICML', assetFolder: 'icml', fileExtensions: [".bst",".sty",".tex",".bib"], mapping: { authorStyle: 'nature', citationStyle: 'numeric', columnLayout: 'single', algorithmPackage: 'algorithmicx' } },
  { id: 'conf_cvpr', label: 'CVPR/ICCV', icon: '👁️', category: 'Conference', subCategory: 'Vision', desc: 'Computer Vision and Pattern Recognition.', publisher: 'IEEE/CVF', assetFolder: 'cvpr', fileExtensions: [".sty",".bst",".tex",".bib"], mapping: { authorStyle: 'ieee', citationStyle: 'numeric', bibliographyStyle: 'IEEEtran', columnLayout: 'double' } },
  { id: 'conf_emnlp', label: 'EMNLP/ACL', icon: '🗣️', category: 'Conference', subCategory: 'NLP', desc: 'Computational Linguistics (ACL/EMNLP).', publisher: 'ACL', assetFolder: 'acl', fileExtensions: [".sty",".bst",".tex",".bib"], mapping: { authorStyle: 'nature', citationStyle: 'authoryear', columnLayout: 'single' } },

  // --- PRESENTATION (BEAMER) ---
  { id: 'beamer_metropolis', label: 'Metropolis', icon: '🏙️', category: 'Presentation', subCategory: 'Modern', desc: 'Modern minimalist Beamer theme.', publisher: 'Generic', assetFolder: 'beamer', fileExtensions: [".tex",".bst",".bib"] },
  { id: 'beamer_madrid', label: 'Madrid', icon: '🏛️', category: 'Presentation', subCategory: 'Classic', desc: 'Traditional blue-themed Beamer slides.', publisher: 'Generic', assetFolder: 'beamer', fileExtensions: [".tex",".bst",".bib"] },
  { id: 'beamer_berlin', label: 'Berlin', icon: '🇩🇪', category: 'Presentation', subCategory: 'Academic', desc: 'Professional navigation-heavy theme.', publisher: 'Generic', assetFolder: 'beamer', fileExtensions: [".tex",".bst",".bib"] },
  { id: 'beamer_cambridge', label: 'Cambridge US', icon: '🎓', category: 'Presentation', subCategory: 'Academic', desc: 'Clean academic presentation style.', publisher: 'Generic', assetFolder: 'beamer', fileExtensions: [".tex",".bst",".bib"] },
  { id: 'beamer_focus', label: 'Focus', icon: '🎯', category: 'Presentation', subCategory: 'Minimal', desc: 'High-contrast focused presentation.', publisher: 'Generic', assetFolder: 'beamer', fileExtensions: [".tex",".bst",".bib"] },
];

export function getTemplateById(id: string) {
  return TEMPLATE_REGISTRY.find(t => t.id === id);
}

export function mapLegacyTemplateId(id: string): string {
  const map: Record<string, string> = {
    't1': 'ieee_tpami',
    't2': 'acm_cacm',
    't3': 'elsevier_ai',
    't4': 'springer_ml',
    't5': 'plos_one',
    't6': 'scirep'
  };
  return map[id] || id;
}
