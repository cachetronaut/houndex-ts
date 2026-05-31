'use client';

import { useMemo, useState } from 'react';
import { demoEnvelope, demoVerdict, reviewItems } from '../lib/demoData';
import { nextPendingIndex, type ReviewDecision, summarizeReview } from '../lib/reviewModel';

const decisionLabels: Record<ReviewDecision, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function Page() {
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const items = useMemo(
    () =>
      reviewItems.map((item) => ({
        ...item,
        decision: decisions[item.claim.claimId] ?? item.decision,
      })),
    [decisions],
  );
  const selected = items[selectedIndex] ?? items[0];
  const summary = summarizeReview(items);

  function decide(claimId: string, decision: ReviewDecision) {
    setDecisions((current) => ({ ...current, [claimId]: decision }));
    setSelectedIndex((currentIndex) =>
      decision === 'pending' ? currentIndex : nextPendingIndex(items, currentIndex),
    );
  }

  if (selected === undefined) return null;

  return (
    <main className="shell">
      <section className="mast">
        <div>
          <p className="eyebrow">Synthetic review workspace</p>
          <h1>Houndex claim control</h1>
        </div>
        <div className="verdict" data-pass={demoVerdict.passed}>
          <span>{demoVerdict.passed ? 'PASS' : 'FAIL'}</span>
          <strong>{demoVerdict.total.toFixed(3)}</strong>
        </div>
      </section>

      <section className="metrics" aria-label="Review metrics">
        <Metric label="Claims" value={summary.total} />
        <Metric label="Grounded" value={summary.grounded} />
        <Metric label="Needs review" value={summary.needsReview} />
        <Metric label="Approved" value={summary.approved} />
      </section>

      <section className="workbench">
        <aside className="queue" aria-label="Claim review queue">
          <div className="panelHeader">
            <span>Queue</span>
            <strong>{summary.pending} open</strong>
          </div>
          {items.map((item, index) => (
            <button
              className="queueItem"
              data-active={index === selectedIndex}
              data-decision={item.decision}
              key={item.claim.claimId}
              onClick={() => setSelectedIndex(index)}
              type="button"
            >
              <span className="statusRail" />
              <span>
                <strong>{item.claim.subject}</strong>
                <small>{item.claim.category}</small>
              </span>
              <em>{decisionLabels[item.decision]}</em>
            </button>
          ))}
        </aside>

        <section className="claimPane" aria-label="Selected claim">
          <div className="claimHeader">
            <div>
              <p>{selected.claim.sourceTier}</p>
              <h2>{selected.claim.claimText}</h2>
            </div>
            <span className="pill" data-verdict={selected.citation.verdict}>
              {selected.citation.verdict}
            </span>
          </div>

          <div className="evidenceBand">
            <article>
              <span>Evidence</span>
              <p>{selected.claim.evidenceText}</p>
            </article>
            <article>
              <span>Source excerpt</span>
              <p>{selected.sourceExcerpt}</p>
            </article>
          </div>

          <div className="provenance">
            <div className="node sourceNode">Source</div>
            <div className="line" />
            <div className="node claimNode">Claim</div>
            <div className="line" />
            <div className="node verdictNode">Verdict</div>
          </div>

          <div className="reviewGrid">
            <div>
              <span>Claim id</span>
              <code>{selected.claim.claimId}</code>
            </div>
            <div>
              <span>Source</span>
              <code>{selected.claim.sourceUrl}</code>
            </div>
            <div>
              <span>Citation note</span>
              <p>{selected.citation.rationale}</p>
            </div>
          </div>

          <div className="actions">
            <button
              className="secondary"
              onClick={() => decide(selected.claim.claimId, 'pending')}
              type="button"
            >
              Reopen
            </button>
            <button
              className="danger"
              onClick={() => decide(selected.claim.claimId, 'rejected')}
              type="button"
            >
              Reject
            </button>
            <button
              className="primary"
              onClick={() => decide(selected.claim.claimId, 'approved')}
              type="button"
            >
              Approve
            </button>
          </div>
        </section>

        <aside className="trace" aria-label="Envelope trace">
          <div className="panelHeader">
            <span>Envelope trace</span>
            <strong>{demoEnvelope.trace.length}</strong>
          </div>
          {demoEnvelope.trace.map((entry) => (
            <div className="traceRow" key={entry.claimId}>
              <span>{entry.mechanism}</span>
              <code>{entry.claimId}</code>
            </div>
          ))}
          <div className="notes">
            {demoVerdict.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
