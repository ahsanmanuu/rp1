import { TEMPLATE_REGISTRY } from '../src/lib/templates/registry';
const subs = new Set();
TEMPLATE_REGISTRY.forEach(t => {
  if (t.subCategory) subs.add(t.subCategory);
});
console.log(Array.from(subs).sort());