import { robustPreambleInjector } from './compiler-utils';

const input = "\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}";
const output = robustPreambleInjector(input);

console.log("--- OUTPUT START ---");
console.log(output);
console.log("--- OUTPUT END ---");

if (output.includes("\\ifdefined") && output.includes("\\newcommand")) {
    console.log("SUCCESS: Backslashes found.");
} else {
    console.log("FAILURE: Backslashes missing!");
}
