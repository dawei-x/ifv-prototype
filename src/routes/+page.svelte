<script lang="ts">
	import IFVSlider from '$lib/../components/IFVSlider.svelte';
	import { calculateRIQ, type IFV } from '$lib/ifv';
	import { fade } from 'svelte/transition';

	// Add a unique ID for robust list management and animations
	type IFVWithId = IFV & { id: string };
	let ifvs: IFVWithId[] = [];

	let results: { name: string; riq: number }[] = [];
	let dirty = false;

	$: sortedResults = [...results].sort((a, b) => {
		if (isNaN(a.riq)) return 1;
		if (isNaN(b.riq)) return -1;
		return b.riq - a.riq;
	});

	$: maxAbsRIQ = Math.max(
		...results.map((r) => Math.abs(r.riq)).filter((v) => !isNaN(v)),
		1
	);

	function addIFV() {
		const newIFV: IFVWithId = {
			id: crypto.randomUUID(),
			name: `Candidate ${ifvs.length + 1}`,
			mu: 0.4,
			nu: 0.3
		};
		ifvs = [...ifvs, newIFV];
		dirty = true;
	}

	function updateIFV(id: string, updated: IFV) {
		ifvs = ifvs.map((ifv) => (ifv.id === id ? { ...ifv, ...updated } : ifv));
		dirty = true;
	}

	function removeIFV(idToRemove: string) {
		ifvs = ifvs.filter((ifv) => ifv.id !== idToRemove);
		dirty = true;
	}

	function calculate() {
		results = calculateRIQ(ifvs);
		dirty = false;
	}

	/** OKLCH diverging palette (teal for +, vermilion for -) */
	function oklchColorForRIQ(riq: number, maxAbs: number): { bg: string; text: string } {
		const m = Math.min(1, Math.abs(riq) / Math.max(1e-9, maxAbs));
		if (m < 0.02) return { bg: 'oklch(0.92 0 0)', text: '#111827' };
		const eased = Math.pow(m, 0.8);
		const L = 0.90 - eased * 0.32;        // 0.90 → 0.58
		const C = 0.03 + eased * 0.08;        // 0.03 → 0.11
		const h = riq >= 0 ? 170 : 25;        // teal / vermilion
		const bg = `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${h})`;
		const text = L > 0.72 ? '#111827' : 'rgba(255,255,255,0.95)';
		return { bg, text };
	}
</script>

<svelte:head>
	<title>IFV Decision Tool</title>
</svelte:head>

<main class="page">
	<header class="page-header">
		<h1>IFV Decision Support System Prototype</h1>
		<p>Adjust membership (μ) and non-membership (ν) degrees to specify candidate intuitionistic fuzzy values (IFVs).</p>
	</header>

	<section class="card">
		<!-- Candidate Pool heading (restored) -->
		<div class="card-head">
			<h2>Candidate Pool</h2>
		</div>

		<!-- Top Add button only when there are no candidates yet -->
		{#if ifvs.length === 0}
			<div class="empty-add">
				<button on:click={addIFV} class="btn btn-primary">+ Add Candidate</button>
			</div>
		{/if}

		<div class="ifv-list">
			{#each ifvs as ifv (ifv.id)}
				<div class="ifv-row" transition:fade={{ duration: 250 }}>
					<IFVSlider
						name={ifv.name}
						mu={ifv.mu}
						nu={ifv.nu}
						onUpdate={(updated) => updateIFV(ifv.id, updated)}
						onRemove={() => removeIFV(ifv.id)}
					/>
				</div>
			{/each}
		</div>

		<!-- Inline add to the right of the last row -->
		{#if ifvs.length > 0}
			<div class="inline-add">
				<button on:click={addIFV} class="btn btn-primary">+ Add Candidate</button>
			</div>
		{/if}

		{#if ifvs.length > 0}
			<div class="actions">
				<button on:click={calculate} class="btn btn-secondary" class:btn-dirty={dirty}>
					{dirty ? 'Update Results' : 'Calculate'}
				</button>
			</div>
		{/if}
	</section>

	{#if results.length > 0}
		<section class="results">
			<h2 class="results-title">Ranking Results</h2>
			{#if dirty}
				<div class="warning-banner" role="alert">
					<p>⚠️ The candidate values have changed.</p>
				</div>
			{/if}

			<div class="results-grid">
				<div class="card">
					<h3>Ranking</h3>
					<div class="mt-4 border rounded-lg overflow-hidden">
						<table class="w-full table-auto">
							<thead>
								<tr class="text-left text-sm bg-slate-50">
									<th class="p-3 font-semibold text-slate-600">Rank</th>
									<th class="p-3 font-semibold text-slate-600">Candidate</th>
									<th class="p-3 font-semibold text-slate-600 text-right">Index</th>
								</tr>
							</thead>
							<tbody class="table-striped">
								{#each sortedResults as r, i}
									<tr>
										<td class="p-3 text-center font-bold text-slate-400">{i + 1}</td>
										<td class="p-3 font-medium text-slate-700">{r.name}</td>
										<td
											class="p-3 font-mono font-semibold text-right"
											class:text-green-600={r.riq >= 0}
											class:text-red-600={r.riq < 0}
										>
											{isNaN(r.riq) ? 'NaN' : r.riq.toFixed(4)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>

				<div class="card">
					<h3>Chart</h3>
					<div class="chart-grid">
						<!-- Overlay grid (keep h/v lines + labels; per-row zero line is in CSS) -->
						<div class="chart-grid-overlay">
							<div class="line h-line" />
							<div class="line v-line" style="left: 25%;" />
							<div class="line v-line" style="left: 75%;" />
							<div class="scale-labels">
								<span style="left: 0%; transform: translateX(0);">- {maxAbsRIQ.toFixed(2)}</span>
								<span style="left: 25%; transform: translateX(-50%);">-{(maxAbsRIQ / 2).toFixed(2)}</span>
								<span style="left: 50%; transform: translateX(-50%);">0</span>
								<span style="left: 75%; transform: translateX(-50%);">+{(maxAbsRIQ / 2).toFixed(2)}</span>
								<span style="left: 100%; transform: translateX(-100%);">+ {maxAbsRIQ.toFixed(2)}</span>
							</div>
						</div>

						{#each sortedResults as r (r.name)}
							<div class="bar-label">{r.name}</div>
							<div class="bar-area">
								{#if !isNaN(r.riq)}
									{@const percentage = (r.riq / maxAbsRIQ) * 50}
									{@const colors = oklchColorForRIQ(r.riq, maxAbsRIQ)}
									<div
										class="bar {r.riq >= 0 ? 'positive' : 'negative'}"
										style="
											width: {Math.abs(percentage)}%;
											background: {colors.bg};
											color: {colors.text};
										"
										aria-label="RIQ {r.riq.toFixed(3)}"
									>
										<span class="bar-value">{r.riq.toFixed(3)}</span>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>
		</section>
	{/if}
</main>

<style>
	:root {
		--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif,
			'Apple Color Emoji', 'Segoe UI Emoji';
		--color-primary: #4f46e5;
		--color-primary-hover: #4338ca;
		--color-secondary: #16a34a;
		--color-secondary-hover: #15803d;
		--color-accent: #f97316;
		--color-accent-hover: #ea580c;
	}

	:global(body) {
		font-family: var(--font-sans);
		background-color: #f8fafc;
		color: #334155;
		margin: 0;
	}

	/* Page container */
	.page {
		max-width: 80rem; /* ~1280px */
		margin: 0 auto;
		padding: 1rem;
	}
	@media (min-width: 768px) { .page { padding: 2rem; } }

	/* Header centered */
	.page-header {
		text-align: center;
		margin-bottom: 2rem;
	}
	.page-header h1 {
		margin: 0;
		font-size: clamp(1.75rem, 2.5vw, 2.25rem);
		font-weight: 800;
		color: #1f2937; /* slate-800 */
	}
	.page-header p {
		margin: 0.25rem 0 0 0;
		font-size: 1.125rem;
		color: #64748b; /* slate-500 */
	}

	.card {
		background-color: white;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 1.5rem;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.05);
	}

	/* Candidate Pool heading row */
	.card-head {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		margin-bottom: 0.5rem;
	}
	.card-head h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: #334155;
	}

	/* When no candidates: center the top add button */
	.empty-add {
		display: flex;
		justify-content: center;
		margin-top: 0.5rem;
	}

	/* IFV list */
	.ifv-list {
		padding-top: 0.75rem;
		display: grid;
		gap: 1rem;
	}
	/* Constrain each IFV row so the slider isn't too wide */
	.ifv-row { max-width: 720px; margin: 0 auto; }

	/* Inline + Add at the right of the last candidate */
	.inline-add {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.75rem;
	}

	/* Center the Calculate / Update button */
	.actions {
		display: flex;
		justify-content: center;
		padding-top: 1.25rem;
		margin-top: 1rem;
		border-top: 1px solid #e2e8f0;
	}

	.btn {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-weight: 600;
		color: white;
		border: none;
		transition: background-color 0.2s ease, transform 0.1s ease;
	}
	.btn:hover { transform: translateY(-1px); }
	.btn-primary { background-color: var(--color-primary); }
	.btn-primary:hover { background-color: var(--color-primary-hover); }
	.btn-secondary { background-color: var(--color-secondary); }
	.btn-secondary:hover { background-color: var(--color-secondary-hover); }
	.btn-dirty { background-color: var(--color-accent); }
	.btn-dirty:hover { background-color: var(--color-accent-hover); }

	/* Results section */
	.results { margin-top: 2rem; }
	.results-title {
		margin: 0 0 1rem 0;
		font-size: 1.5rem;
		font-weight: 700;
		color: #1f2937;
		text-align: left;
	}

	/* Two-panel grid: 1 column on mobile, 2/3 split on desktop */
	.results-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2rem;
		align-items: start;
	}
	@media (min-width: 900px) {
		.results-grid { grid-template-columns: 2fr 3fr; }
	}

	/* Table polish */
	.table-striped tr:nth-child(even) { background-color: #f8fafc; }
	td, th { border-color: #e2e8f0; }
	.bg-slate-50 { background-color: #f8fafc; }
	.text-slate-600 { color: #475569; }
	.text-slate-400 { color: #94a3b8; }
	.text-slate-700 { color: #334155; }

	/* Chart */
	.chart-grid {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.75rem 0;
		position: relative;
		padding-top: 2rem;
		margin-top: 0.5rem;
	}
	.chart-grid-overlay {
		grid-column: 2 / 3;
		grid-row: 1 / -1;
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.bar-label {
		grid-column: 1 / 2;
		text-align: right;
		padding-right: 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #475569;
		white-space: nowrap;
		align-self: center;
	}
	.bar-area {
		grid-column: 2 / 3;
		position: relative;
		height: 1.5rem; /* compact */
	}

	/* Per-row zero line */
	.bar-area::before {
		content: "";
		position: absolute;
		left: 50%;
		top: -0.5rem;
		bottom: -0.5rem;
		width: 2px;
		background-color: #94a3b8;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.line { position: absolute; background-color: #e2e8f0; }
	.h-line { top: 50%; width: 100%; height: 1px; transform: translateY(-50%); }
	.v-line { top: -0.5rem; bottom: -0.5rem; width: 1px; }

	.scale-labels {
		position: absolute;
		top: -1.5rem;
		width: 100%;
		font-size: 0.75rem;
		color: #64748b;
	}
	.scale-labels span { position: absolute; }

	.bar {
		position: absolute;
		top: 0;
		height: 100%;
		border-radius: 0.375rem;
		display: flex;
		align-items: center;
		/* subtle outline looks refined on OKLCH fills */
		box-shadow: inset 0 0 0 1px rgba(0,0,0,0.06);
	}
	/* Positioning; color set inline via OKLCH */
	.bar.positive { left: 50%; justify-content: flex-end; padding-right: 0.5rem; }
	.bar.negative { right: 50%; justify-content: flex-start; padding-left: 0.5rem; }
	.bar-value { font-size: 0.75rem; font-weight: 600; }
	
	.warning-banner {
		background-color: #fffbeb;
		border: 1px solid #fde68a;
		color: #b45309;
		padding: 1rem;
		border-radius: 0.5rem;
		font-weight: 500;
	}
</style>
