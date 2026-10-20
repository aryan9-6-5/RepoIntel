import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { splitInference } from '@/lib/inference';

/**
 * Renders model output as Markdown (tables, lists, code). Raw HTML is not rendered. Lines the model marks "Inference:" get an
 * amber callout so they stay visibly apart from claims that cite code. The app is dark-only, hence prose-invert.
 */
export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-sm">
      {splitInference(content).map((part, i) =>
        part.inference ? (
          <p key={i} className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-foreground">
            <span className="mr-2 rounded bg-amber-500/20 px-1 text-xs font-medium text-amber-500">Inference, not shown in the code</span>
            {part.text}
          </p>
        ) : (
          <div key={i} className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{ table: (props) => <div role="region" aria-label="Table" tabIndex={0} className="overflow-x-auto"><table {...props} /></div> }}
            >
              {part.text}
            </ReactMarkdown>
          </div>
        ),
      )}
    </div>
  );
}
