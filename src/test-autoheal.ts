const { autoHealLatex } = require('./lib/latex');

const testCases = [
  {
    name: 'Standard Figure',
    input: '\\includegraphics[width=0.85\\linewidth,keepaspectratio]{rf_fig_0.jpg}'
  },
  {
    name: 'Figure with Space',
    input: '\\includegraphics [width=0.85\\linewidth] {fig_1.png}'
  },
  {
    name: 'Underscore in text',
    input: 'This is a test_of_underscore.'
  },
  {
    name: 'Mixed Figure and Text',
    input: 'As seen in \\includegraphics{img_01}, the result is_correct.'
  }
];

testCases.forEach(tc => {
  console.log(`--- ${tc.name} ---`);
  console.log(`Input: ${tc.input}`);
  const result = autoHealLatex(tc.input);
  console.log(`Result: ${result}`);
});
