import { useMemo, useState } from 'react';
import { BookOpen, FileText, LockKeyhole, Scale, ShieldCheck } from 'lucide-react';
import { RECOMMENDED_MODELS, getModelLegalInfo } from '../modelsData';

type PolicyPage = 'privacy' | 'terms' | 'acceptable' | 'licenses';

const pages: { id: PolicyPage; label: string; icon: typeof LockKeyhole }[] = [
  { id: 'privacy', label: 'Privacy', icon: LockKeyhole },
  { id: 'terms', label: 'Terms', icon: Scale },
  { id: 'acceptable', label: 'Acceptable Use', icon: ShieldCheck },
  { id: 'licenses', label: 'Model Licenses', icon: BookOpen },
];

export default function PolicyTab() {
  const [page, setPage] = useState<PolicyPage>('privacy');
  const legalModels = useMemo(() => RECOMMENDED_MODELS.map(model => ({ model, legal: getModelLegalInfo(model) })), []);

  return (
    <main className="policy-center">
      <header className="workspace-header">
        <div className="workspace-header__title">
          <FileText size={24} />
          <div>
            <h2>Policy & Legal Center</h2>
            <p>How Local Model Lab handles local data, responsible use, third-party models, and software licenses.</p>
          </div>
        </div>
        <span className="policy-date">Effective July 14, 2026</span>
      </header>

      <div className="policy-layout">
        <nav className="policy-nav" aria-label="Policy pages">
          {pages.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}>
                <Icon size={16} /><span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <article className="policy-document">
          {page === 'privacy' && (
            <>
              <h1>Privacy Policy</h1>
              <p className="policy-lead">Local Model Lab is designed for local inference. It does not require an account and does not include advertising, analytics, or telemetry.</p>
              <h2>Data processed on your device</h2>
              <p>Prompts, chat responses, system instructions, generated images, imported models, and inference logs are processed locally. Local Model Lab does not transmit this content to a Local Model Lab-operated server.</p>
              <h2>Network activity</h2>
              <p>The app connects to Hugging Face when you verify or download a model and to GitHub when you install the optional stable-diffusion.cpp backend. Those services receive normal request information such as your IP address and user agent under their own privacy terms. Local A1111, Forge, and ComfyUI connections use loopback addresses only.</p>
              <h2>Files and settings</h2>
              <p>Models, partial downloads, generations, and app settings are stored under your operating system user-data directories. The Store release keeps Safety Lock enabled. You can remove model files from Model Library, remove generated images from their output folder, or uninstall the app and delete its user-data folder.</p>
              <h2>Permissions and security</h2>
              <p>The desktop renderer uses an allowlisted IPC bridge. Model downloads are limited to HTTPS Hugging Face sources and are checked for response type and expected size. No local application can guarantee protection from a compromised operating system, malicious model file, or software you install separately.</p>
              <h2>Children</h2>
              <p>Local Model Lab is not directed to children. Users must meet the minimum age required by local law and any third-party model license. Sexual content involving minors is always prohibited.</p>
              <h2>Changes and contact</h2>
              <p>Material policy changes will be published with a new effective date. Until a public support address is configured, privacy and policy requests should be submitted through the official GitHub repository issue tracker shown on the project website.</p>
            </>
          )}

          {page === 'terms' && (
            <>
              <h1>Terms of Use</h1>
              <p className="policy-lead">By using Local Model Lab, you agree to use the software lawfully and to review the terms attached to every third-party model you download.</p>
              <h2>Local software</h2>
              <p>Local Model Lab uses live generative AI to create text and images from user prompts on the user's device. The app does not promise that model output is accurate, complete, unbiased, or suitable for professional decisions. Verify important output independently.</p>
              <h2>Your responsibilities</h2>
              <p>You are responsible for prompts, imported files, generated output, distribution, and compliance with applicable law. You must have the rights needed for source images, models, datasets, and other material you use.</p>
              <h2>Third-party models and services</h2>
              <p>Model weights are hosted by third parties and are not sold or sublicensed by Local Model Lab. Each model remains subject to its repository license, acceptable-use restrictions, attribution requirements, and commercial-use limits. Availability can change without notice.</p>
              <h2>No warranty</h2>
              <p>The software is provided on an as-is and as-available basis to the maximum extent permitted by law. Downloads, hardware compatibility, generation speed, output quality, and continued third-party availability are not guaranteed.</p>
              <h2>Limitation of liability</h2>
              <p>To the maximum extent permitted by law, the project maintainers are not liable for indirect, incidental, special, consequential, or punitive damages, loss of data, lost profits, or claims arising from model output or third-party content.</p>
              <h2>Suspension and changes</h2>
              <p>Features or catalog entries may be changed or removed to address security, legal, licensing, or availability issues. These terms are governed by applicable law; mandatory consumer protections remain unaffected.</p>
            </>
          )}

          {page === 'acceptable' && (
            <>
              <h1>Acceptable Use Policy</h1>
              <p className="policy-lead">Local processing does not remove legal or ethical responsibilities. The safety lock is a helpful control, not a substitute for judgment or supervision.</p>
              <h2>Always prohibited</h2>
              <ul>
                <li>Sexual content involving minors or anyone presented as underage.</li>
                <li>Non-consensual sexual content, sexual exploitation, trafficking, or intimate imagery shared without consent.</li>
                <li>Instructions or assistance intended to facilitate violent wrongdoing, abuse, stalking, or credible threats.</li>
                <li>Malware, credential theft, unauthorized access, destructive cyber activity, or evasion intended to harm others.</li>
                <li>Fraud, impersonation, deceptive synthetic media, targeted harassment, or unlawful discrimination.</li>
                <li>Infringement of copyright, privacy, publicity, trademark, or other rights.</li>
              </ul>
              <h2>High-impact decisions</h2>
              <p>Do not use unverified model output as the sole basis for medical, legal, financial, employment, housing, education, insurance, credit, or law-enforcement decisions.</p>
              <h2>Safety Lock</h2>
              <p>The Store release keeps its local Safety Lock enabled and blocks common explicit prompts, sexual content involving minors, non-consensual sexual content, and exploitation. The guard is pattern-based, can miss harmful requests, and does not replace output review or model-specific license rules.</p>
              <h2>Reporting</h2>
              <p>Use Report unsafe output in Settings for offensive generated content. Security, licensing, and catalog concerns can use the same official GitHub issue tracker. Do not include private prompts, generated content, personal data, or sensitive local file paths in a public issue.</p>
            </>
          )}

          {page === 'licenses' && (
            <>
              <h1>Third-Party Models & Notices</h1>
              <p className="policy-lead">The catalog links to independently published model files. Review the repository card and full license before use, especially for commercial or public distribution.</p>
              <div className="license-table" role="table" aria-label="Model licenses">
                <div className="license-table__head" role="row"><span>Model</span><span>Publisher / repository</span><span>License</span></div>
                {legalModels.map(({ model, legal }) => (
                  <div className="license-table__row" role="row" key={model.id}>
                    <span>{model.name}</span><span>{legal.repository}</span><span>{legal.license}</span>
                  </div>
                ))}
              </div>
              <h2>Software notices</h2>
              <p>Local Model Lab includes or interoperates with open-source software including Electron, Chromium, React, Vite, llama.cpp, node-llama-cpp, stable-diffusion.cpp, Axios, and Lucide. Their copyright notices and licenses remain with their respective authors. The packaged application should distribute required notices with the release.</p>
              <h2>No license override</h2>
              <p>Nothing in Local Model Lab's terms expands a third-party license. When these policies and a model license differ, comply with the stricter applicable requirement.</p>
            </>
          )}
        </article>
      </div>
    </main>
  );
}
