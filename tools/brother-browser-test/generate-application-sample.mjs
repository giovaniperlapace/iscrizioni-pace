// Run from the repository root. The same renderer is used by the authenticated print route.
import { writeFileSync } from 'node:fs';
import { renderQrLabelHtml } from '../../lib/qrcode/print-label.ts';
const html = await renderQrLabelHtml('test_aB3dE5fG7hJ9kL2mN4pQ6rS8tU0vW1xY3zA5bC', {
  first_name: 'José María', last_name: 'García López', public_code: 'TEST-001',
});
writeFileSync(new URL('./app-label-test.html', import.meta.url), html.replace('<main>', '<main><p><strong>Campione sintetico · prova del renderer applicativo · nessun collegamento al database.</strong></p>'));
console.log('Campione sintetico applicativo: tools/brother-browser-test/app-label-test.html');
