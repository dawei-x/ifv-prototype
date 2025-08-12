<script lang="ts">
	import IFVSlider from '$lib/../components/IFVSlider.svelte';
	import { calculateRIQ, type IFV } from '$lib/ifv';
	import { fade, scale } from 'svelte/transition';

	type Pool = {
		id: string;
		name: string;
		ifvs: IFV[];
		results: { name: string; riq: number }[];
		dirty: boolean;
		hasCalculated: boolean;
		minimized: boolean;
	};

	let pools: Pool[] = [];
	let owaWeightsRaw: number[] = []; // 0..10 integers, length == pools.length

	/* ---------- helpers ---------- */
	function defaultIFV(name: string): IFV { return { name, mu: 0.4, nu: 0.3 }; }
	function nextPoolName() { return `Candidate Pool ${pools.length + 1}`; }
	function nextCandidateName() {
		const len = pools[0]?.ifvs.length ?? 0;
		return `Candidate ${len + 1}`;
	}
	function cloneNamesFromLastPool(): string[] {
		// If no pools yet → one candidate. Otherwise clone names from last pool.
		if (pools.length === 0) return ['Candidate 1'];
		return pools[pools.length - 1].ifvs.map((x) => x.name);
	}

	/* ---------- pools ---------- */
	function addPool() {
		const names = cloneNamesFromLastPool();
		const newPool: Pool = {
			id: crypto.randomUUID(),
			name: nextPoolName(),
			ifvs: names.map((n) => defaultIFV(n)),
			results: [],
			dirty: true,
			hasCalculated: false,
			minimized: false
		};
		pools = [...pools, newPool];
		owaWeightsRaw = [...owaWeightsRaw, 0];
	}
	function removePool(poolId: string) {
		const idx = pools.findIndex((p) => p.id === poolId);
		if (idx === -1) return;
		pools = pools.filter((p) => p.id !== poolId);
		owaWeightsRaw = owaWeightsRaw.filter((_, i) => i !== idx);
		if (pools.length === 0) addPool();
	}
	function toggleMinimize(poolId: string) {
		pools = pools.map((p) => (p.id === poolId ? { ...p, minimized: !p.minimized } : p));
	}
	function renamePool(poolId: string, name: string) {
		pools = pools.map((p) => (p.id === poolId ? { ...p, name } : p));
	}

	/* ---------- candidates (keep alignment across pools) ---------- */
	function addCandidateAll() {
		const newName = nextCandidateName();
		pools = pools.map((p) => ({
			...p,
			ifvs: [...p.ifvs, defaultIFV(newName)],
			dirty: true
		}));
	}
	function removeCandidateAll(atIndex: number) {
		pools = pools.map((p) => {
			const next = [...p.ifvs];
			next.splice(atIndex, 1);
			return { ...p, ifvs: next, dirty: true };
		});
	}
	function updateIFVForPool(poolId: string, index: number, updated: IFV) {
		const pool = pools.find((p) => p.id === poolId);
		if (!pool) return;
		const old = pool.ifvs[index];
		const nameChanged = updated.name !== old.name;

		// Update μ,ν (+ name) in this pool
		pools = pools.map((p) => {
			if (p.id !== poolId) return p;
			const nextIFVs = [...p.ifvs];
			nextIFVs[index] = { ...nextIFVs[index], mu: updated.mu, nu: updated.nu, name: updated.name };
			return { ...p, ifvs: nextIFVs, dirty: true };
		});

		// Propagate name to same index across pools
		if (nameChanged) {
			pools = pools.map((p) => {
				const nextIFVs = [...p.ifvs];
				if (nextIFVs[index]) nextIFVs[index] = { ...nextIFVs[index], name: updated.name };
				return { ...p, ifvs: nextIFVs };
			});
		}
	}

	/* ---------- calculate ---------- */
	function recalcAllPools() {
		pools = pools.map((p) => {
			const results = calculateRIQ(p.ifvs);
			return { ...p, results, dirty: false, hasCalculated: true };
		});
	}
	function calculatePool(_poolId: string) {
		// Update all pools so names/status sync across all results (as requested)
		recalcAllPools();
	}

	/* ---------- OWA weights (position weights) ---------- */
	function setWeight(i: number, val: number) {
		const v = Math.max(0, Math.min(10, Math.round(val)));
		owaWeightsRaw = owaWeightsRaw.map((w, idx) => (idx === i ? v : w));
	}
	function normalize(arr: number[]): number[] {
		const sum = arr.reduce((a, b) => a + b, 0);
		if (sum <= 0) return arr.length ? arr.map(() => 1 / arr.length) : [];
		return arr.map((x) => x / sum);
	}
	$: normPreview = normalize(owaWeightsRaw.slice(0, pools.length));

	/* ---------- derived ---------- */
	function sortedResultsOf(results: { name: string; riq: number }[]) {
		return [...results].sort((a, b) => {
			if (isNaN(a.riq)) return 1;
			if (isNaN(b.riq)) return -1;
			return b.riq - a.riq;
		});
	}
	function maxAbsOf(results: { riq: number }[]) {
		return Math.max(...results.map((r) => Math.abs(r.riq)).filter((v) => !isNaN(v)), 1);
	}

	/* ---------- OWA aggregation across pools (only calculated pools) ---------- */
	$: activePools = pools.filter((p) => p.results.length === p.ifvs.length && p.ifvs.length > 0);

	$: finalAggregated = (() => {
		if (activePools.length === 0) return [];
		const m = activePools.length;
		const count = activePools[0].ifvs.length;
		const normW = normalize(owaWeightsRaw.slice(0, m));
		const out: { name: string; riq: number }[] = [];
		for (let i = 0; i < count; i++) {
			const riqs = activePools.map((p) => p.results[i]?.riq ?? NaN).filter((x) => !isNaN(x));
			const sorted = [...riqs].sort((a, b) => b - a);
			const agg = sorted.reduce((acc, val, k) => acc + val * (normW[k] ?? 0), 0);
			const name = activePools[0].ifvs[i]?.name ?? `Candidate ${i + 1}`;
			out.push({ name, riq: parseFloat(agg.toFixed(4)) });
		}
		return out;
	})();

	$: finalSorted = sortedResultsOf(finalAggregated);
	$: finalMaxAbs = maxAbsOf(finalAggregated);

	/* ---------- colors ---------- */
	function oklchForValue(v: number, maxAbs: number): { bg: string; text: string } {
		const m = Math.min(1, Math.abs(v) / Math.max(1e-9, maxAbs));
		if (m < 0.02) return { bg: 'oklch(0.92 0 0)', text: '#111827' };
		const eased = Math.pow(m, 0.8);
		const L = 0.90 - eased * 0.32;
		const C = 0.03 + eased * 0.08;
		const h = v >= 0 ? 170 : 25;
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

	<!-- Toolbar + OWA -->
	<section class="card">
		<div class="pools-toolbar">
			<button class="btn btn-primary" on:click={addPool}>+ Add Candidate Pool</button>
		</div>

		{#if pools.length > 0}
			<div class="owa">
				<h3 class="owa-title">OWA Weights (position-based)</h3>
				<div class="owa-sliders">
					{#each pools as _, i}
						<div class="owa-row">
							<label class="owa-label">Position {i + 1}{i === 0 ? ' (largest)' : ''}</label>
							<input type="range" min="0" max="10" step="1" value={owaWeightsRaw[i] ?? 0} on:input={(e: any) => setWeight(i, +e.target.value)} />
							<span class="owa-raw">{owaWeightsRaw[i] ?? 0}</span>
						</div>
					{/each}
				</div>
				<div class="owa-preview">
					<span class="owa-preview-label">Normalized:</span>
					{#each normPreview as w, i}
						<span class="owa-chip">w{i + 1}={w.toFixed(3)}</span>
					{/each}
					{#if activePools.length !== pools.length}
						<div class="owa-note">Using {activePools.length}/{pools.length} calculated pools in final aggregation.</div>
					{/if}
				</div>
			</div>
		{/if}
	</section>

	<!-- Pools -->
	{#each pools as pool (pool.id)}
		<section
			class="card pool-card"
			class:minimized={pool.minimized}
			in:scale={{ duration: 180, easing: t => 1 - (1 - t) * (1 - t) }}
			out:fade={{ duration: 120 }}
		>
			<!-- Header: name + icon actions -->
			<div class="pool-head">
				<input class="pool-name" value={pool.name} on:input={(e: any) => renamePool(pool.id, e.currentTarget.value)} />
				<div class="pool-actions">
					<!-- Toggle: chevron-up (minimize) / chevron-down (expand) -->
					<button class="icon-btn" title={pool.minimized ? 'Expand' : 'Minimize'} on:click={() => toggleMinimize(pool.id)} aria-label={pool.minimized ? 'Expand' : 'Minimize'}>
						{#if pool.minimized}
							<!-- chevron-down -->
							<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
								<polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
							</svg>
						{:else}
							<!-- chevron-up -->
							<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
								<polyline points="6 15 12 9 18 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
							</svg>
						{/if}
					</button>

					<!-- Remove: trash (stroke) -->
					<button class="icon-btn danger" title="Remove pool" on:click={() => removePool(pool.id)} aria-label="Remove pool">
						<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
							<path d="M3 6h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
							<path d="M19 6v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>
							<path d="M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
							<path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
						</svg>
					</button>
				</div>
			</div>

			{#if pool.minimized}
				<!-- Minimized: status + Update/Calculate + ranking -->
				<div class="minimized-meta">
					{#if !pool.hasCalculated}
						<span class="badge badge-warn">Not calculated</span>
					{:else if pool.dirty}
						<span class="badge badge-warn">Stale</span>
					{:else}
						<span class="badge badge-ok">Up to date</span>
					{/if}

					<button
						class="btn btn-secondary btn-compact"
						class:btn-dirty={pool.hasCalculated && pool.dirty}
						on:click={() => calculatePool(pool.id)}
					>
						{!pool.hasCalculated ? 'Calculate' : (pool.dirty ? 'Update Results' : 'Calculate')}
					</button>
				</div>

				{#if pool.results.length > 0}
					{@const sorted = sortedResultsOf(pool.results)}
					<div class="mt-2 border rounded-lg overflow-hidden">
						<table class="w-full table-auto condensed">
							<thead>
								<tr class="text-left text-sm bg-slate-50">
									<th class="p-3 font-semibold text-slate-600">Rank</th>
									<th class="p-3 font-semibold text-slate-600">Candidate</th>
									<th class="p-3 font-semibold text-slate-600 text-right">Index</th>
								</tr>
							</thead>
							<tbody class="table-striped">
								{#each sorted as r, i}
									<tr>
										<td class="p-3 text-center font-bold text-slate-400">{i + 1}</td>
										<td class="p-3 font-medium text-slate-700">{r.name}</td>
										<td class="p-3 font-mono font-semibold text-right">{isNaN(r.riq) ? 'NaN' : r.riq.toFixed(4)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="muted">Not calculated yet. Expand to edit and calculate.</p>
				{/if}
			{:else}
				<!-- Expanded -->
				{#if pool.ifvs.length === 0}
					<div class="empty-add"><button class="btn btn-primary" on:click={addCandidateAll}>+ Add Candidate</button></div>
				{/if}

				<div class="ifv-list">
					{#each pool.ifvs as ifv, i (i)}
						<div class="ifv-row" transition:fade={{ duration: 180 }}>
							<IFVSlider
								name={ifv.name}
								mu={ifv.mu}
								nu={ifv.nu}
								onUpdate={(updated) => updateIFVForPool(pool.id, i, updated)}
								onRemove={() => removeCandidateAll(i)}
							/>
						</div>
					{/each}
				</div>

				{#if pool.ifvs.length > 0}
					<div class="inline-add"><button class="btn btn-primary" on:click={addCandidateAll}>+ Add Candidate</button></div>
					<div class="actions">
						<button class="btn btn-secondary" class:btn-dirty={pool.hasCalculated && pool.dirty} on:click={() => calculatePool(pool.id)}>
							{!pool.hasCalculated ? 'Calculate' : (pool.dirty ? 'Update Results' : 'Calculate')}
						</button>
					</div>
				{/if}

				{#if pool.results.length > 0}
					{@const sorted = sortedResultsOf(pool.results)}
					{@const maxAbs = maxAbsOf(pool.results)}
					<section class="space-y-6" transition:fade>
						<h3 class="text-lg font-semibold text-slate-700">Ranking & Chart</h3>
						<div class="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
							<div class="card ghost md:col-span-2">
								<div class="mt-2 border rounded-lg overflow-hidden">
									<table class="w-full table-auto">
										<thead>
											<tr class="text-left text-sm bg-slate-50">
												<th class="p-3 font-semibold text-slate-600">Rank</th>
												<th class="p-3 font-semibold text-slate-600">Candidate</th>
												<th class="p-3 font-semibold text-slate-600 text-right">Index</th>
											</tr>
										</thead>
										<tbody class="table-striped">
											{#each sorted as r, i}
												<tr>
													<td class="p-3 text-center font-bold text-slate-400">{i + 1}</td>
													<td class="p-3 font-medium text-slate-700">{r.name}</td>
													<td class="p-3 font-mono font-semibold text-right">{isNaN(r.riq) ? 'NaN' : r.riq.toFixed(4)}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>

							<div class="card ghost md:col-span-3">
								<h4 class="text-base font-semibold text-slate-700">Chart</h4>
								<div class="chart-grid">
									<div class="chart-grid-overlay">
										<div class="line h-line"></div>
										<div class="line v-line" style="left: 25%;"></div>
										<div class="line v-line" style="left: 75%;"></div>
										<div class="scale-labels">
											<span style="left: 0%; transform: translateX(0);">- {maxAbs.toFixed(2)}</span>
											<span style="left: 25%; transform: translateX(-50%);">-{(maxAbs / 2).toFixed(2)}</span>
											<span style="left: 50%; transform: translateX(-50%);">0</span>
											<span style="left: 75%; transform: translateX(-50%);">+{(maxAbs / 2).toFixed(2)}</span>
											<span style="left: 100%; transform: translateX(-100%);">+ {maxAbs.toFixed(2)}</span>
										</div>
									</div>

									{#each sorted as r (r.name)}
										<div class="bar-label">{r.name}</div>
										<div class="bar-area">
											{#if !isNaN(r.riq)}
												<div
													class="bar {r.riq >= 0 ? 'positive' : 'negative'}"
													style="
														width: {Math.abs((r.riq / maxAbs) * 50)}%;
														background: {oklchForValue(r.riq, maxAbs).bg};
														color: {oklchForValue(r.riq, maxAbs).text};
													"
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
			{/if}
		</section>
	{/each}

	<!-- Aggregated (OWA): vertical bar chart -->
	{#if pools.length > 0}
		<section class="card agg-card">
			<h2 class="results-title">Aggregated Ranking (OWA)</h2>
			{#if finalAggregated.length === 0}
				<p class="muted">No aggregated results yet. Calculate at least one pool to see the combined ranking.</p>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
					<div class="card ghost md:col-span-2">
						<div class="mt-2 border rounded-lg overflow-hidden">
							<table class="w-full table-auto">
								<thead>
									<tr class="text-left text-sm bg-slate-50">
										<th class="p-3 font-semibold text-slate-600">Rank</th>
										<th class="p-3 font-semibold text-slate-600">Candidate</th>
										<th class="p-3 font-semibold text-slate-600 text-right">Final RIQ</th>
									</tr>
								</thead>
								<tbody class="table-striped">
									{#each finalSorted as r, i}
										<tr>
											<td class="p-3 text-center font-bold text-slate-400">{i + 1}</td>
											<td class="p-3 font-medium text-slate-700">{r.name}</td>
											<td class="p-3 font-mono font-semibold text-right">{isNaN(r.riq) ? 'NaN' : r.riq.toFixed(4)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>

					<!-- Vertical chart (even spacing via grid; overlay is non-interactive) -->
					<div class="card ghost md:col-span-3">
						<h4 class="text-base font-semibold text-slate-700">Chart</h4>

						<div class="vwrap">
							<div class="vchart">
								<!-- Y labels (outside plot area but aligned to it) -->
								<div class="vchart-ylabels">
									<span>+{finalMaxAbs.toFixed(2)}</span>
									<span>0</span>
									<span>-{finalMaxAbs.toFixed(2)}</span>
								</div>

								<!-- Zero line centered in the plot area -->
								<div class="vzero-hline"></div>

								<!-- Evenly spaced columns in the plot area (no pointer events) -->
								<div class="vgrid-plot" style="--cols:{finalSorted.length};">
									{#each finalSorted as r (r.name)}
										<div class="vgrid-cell">
											<div class="vbar-area">
												{#if !isNaN(r.riq)}
													<div
														class="vbar {r.riq >= 0 ? 'pos' : 'neg'}"
														style="
															height: {Math.abs((r.riq / finalMaxAbs) * 50)}%;
															background: {oklchForValue(r.riq, finalMaxAbs).bg};
															color: {oklchForValue(r.riq, finalMaxAbs).text};
														"
														aria-label="Final RIQ {r.riq.toFixed(3)}"
													></div>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							</div>

							<!-- Captions aligned to the same column layout (normal flow) -->
							<div class="vchart-x vgrid-x" style="--cols:{finalSorted.length};">
								{#each finalSorted as r (r.name)}
									<div class="vcol-caption">
										<div class="vbar-label" title={r.name}>{r.name}</div>
										<div class="vbar-value">{r.riq.toFixed(3)}</div>
									</div>
								{/each}
							</div>
						</div>
					</div>
				</div>
			{/if}
		</section>
	{/if}
</main>

<style>
	:root{
		--font-sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif,'Apple Color Emoji','Segoe UI Emoji';
		--color-primary:#4f46e5;--color-primary-hover:#4338ca;
		--color-secondary:#16a34a;--color-secondary-hover:#15803d;
		--color-accent:#f97316;--color-accent-hover:#ea580c;

		/* vertical chart aesthetics */
		--vbar-gap: 12px;
	}
	:global(body){font-family:var(--font-sans);background:#f8fafc;color:#334155;margin:0;}
	.page{max-width:80rem;margin:0 auto;padding:1rem;}@media(min-width:768px){.page{padding:2rem;}}
	.page-header{text-align:center;margin-bottom:2rem;}
	.page-header h1{margin:0;font-size:clamp(1.75rem,2.5vw,2.25rem);font-weight:800;color:#1f2937;}
	.page-header p{margin:.25rem 0 0 0;font-size:1.125rem;color:#64748b;}

	.card{background:#fff;border:1px solid #e2e8f0;border-radius:.75rem;padding:1.5rem;box-shadow:0 1px 3px 0 rgb(0 0 0 / .05);}
	.card.ghost{box-shadow:none;padding:0;border:none;}
	.agg-card{margin-top:1.25rem;} /* spacing before aggregated panel */

	.pools-toolbar{display:flex;align-items:center;gap:.75rem;}

	.btn{padding:.5rem 1rem;border-radius:.5rem;font-weight:600;color:#fff;border:none;cursor:pointer;transition:background-color .2s ease, transform .1s ease;}
	.btn:hover{transform:translateY(-1px);}
	.btn-primary{background:var(--color-primary);} .btn-primary:hover{background:var(--color-primary-hover);}
	.btn-secondary{background:var(--color-secondary);} .btn-secondary:hover{background:var(--color-secondary-hover);}
	.btn-dirty{background:var(--color-accent);} .btn-dirty:hover{background:var(--color-accent-hover);}
	.btn-danger{background:#ef4444;} .btn-danger:hover{background:#dc2626;}
	.btn-compact{padding:.35rem .6rem;border-radius:.4rem;}

	/* icon buttons */
	.icon-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#334155;cursor:pointer;}
	.icon-btn:hover{background:#f3f4f6;}
	.icon-btn.danger{color:#dc2626;border-color:#fee2e2;}
	.icon-btn.danger:hover{background:#fee2e2;}
	.icon-btn svg{stroke:currentColor;stroke-width:2;fill:none;}

	/* OWA */
	.owa{margin-top:1rem;}
	.owa-title{margin:0 0 .75rem 0;font-size:1rem;font-weight:700;color:#334155;}
	.owa-sliders{display:grid;gap:.5rem;}
	.owa-row{display:grid;grid-template-columns:12rem 1fr 3rem;gap:.75rem;align-items:center;}
	.owa-label{font-size:.875rem;color:#475569;}
	.owa-raw{text-align:right;font-variant-numeric:tabular-nums;color:#334155;}
	.owa-preview{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin-top:.5rem;}
	.owa-preview-label{font-weight:600;color:#334155;margin-right:.25rem;}
	.owa-chip{background:#eef2ff;color:#3730a3;border-radius:999px;padding:.125rem .5rem;font-size:.75rem;}
	.owa-note{color:#b45309;background:#fffbeb;border:1px solid #fde68a;padding:.25rem .5rem;border-radius:.375rem;font-size:.75rem;}

	/* pool cards */
	.pool-card{margin-top:1rem;}
	.pool-card.minimized{max-width:760px;margin-left:auto;margin-right:auto;}
	.pool-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;}
	.pool-name{font-size:1.125rem;font-weight:700;border:1px solid #e2e8f0;border-radius:.5rem;padding:.25rem .5rem;width:18rem;}
	.pool-actions{display:flex;gap:.5rem;}
	.minimized-meta{display:flex;align-items:center;gap:.5rem;margin:.5rem 0 0 0;}
	.badge{padding:.125rem .5rem;border-radius:.375rem;font-size:.75rem;font-weight:600;}
	.badge-warn{color:#92400e;background:#fef3c7;border:1px solid #fde68a;}
	.badge-ok{color:#065f46;background:#ecfdf5;border:1px solid #a7f3d0;}

	/* IFVs */
	.ifv-list{padding-top:.75rem;display:grid;gap:1rem;}
	.ifv-row{max-width:720px;margin:0 auto;}
	.inline-add{display:flex;justify-content:flex-end;margin-top:.75rem;}
	.empty-add{display:flex;justify-content:center;margin-top:.5rem;}

	/* tables */
	.table-striped tr:nth-child(even){background-color:#f8fafc;}
	td,th{border-color:#e2e8f0;}
	.bg-slate-50{background:#f8fafc;}
	.text-slate-600{color:#475569;}
	.text-slate-400{color:#94a3b8;}
	.text-slate-700{color:#334155;}
	.condensed td,.condensed th{padding-top:.5rem;padding-bottom:.5rem;}
	.muted{color:#6b7280;font-size:.9rem;}

	/* horizontal chart (per pool) */
	.chart-grid{display:grid;grid-template-columns:max-content 1fr;gap:.75rem 0;position:relative;padding-top:2rem;margin-top:.5rem;}
	.chart-grid-overlay{grid-column:2/3;grid-row:1/-1;position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;}
	.bar-label{text-align:right;padding-right:1rem;font-size:.875rem;font-weight:500;color:#475569;white-space:nowrap;align-self:center;}
	.bar-area{position:relative;height:1.5rem;}
	.bar-area::before{content:"";position:absolute;left:50%;top:-.5rem;bottom:-.5rem;width:2px;background:#94a3b8;transform:translateX(-50%);pointer-events:none;}
	.line{position:absolute;background:#e2e8f0;}
	.h-line{top:50%;width:100%;height:1px;transform:translateY(-50%);}
	.v-line{top:-.5rem;bottom:-.5rem;width:1px;}
	.scale-labels{position:absolute;top:-1.5rem;width:100%;font-size:.75rem;color:#64748b;}
	.scale-labels span{position:absolute;}
	.bar{position:absolute;top:0;height:100%;border-radius:.375rem;display:flex;align-items:center;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06);}
	.bar.positive{left:50%;justify-content:flex-end;padding-right:.5rem;}
	.bar.negative{right:50%;justify-content:flex-start;padding-left:.5rem;}
	.bar-value{font-size:.75rem;font-weight:600;color:rgba(0,0,0,.9);}

	/* vertical chart wrapper (shared padding so chart + captions align) */
	.vwrap{
		--vpad-top: 16px;
		--vpad-right: 12px;
		--vpad-bottom: 16px;
		--vpad-left: 56px;

		display:flex; flex-direction:column; gap:8px;
	}
	.vchart{
		position:relative;
		height:240px;
		border:1px solid #e2e8f0; border-radius:.5rem; background:#fff;
		padding: var(--vpad-top) var(--vpad-right) var(--vpad-bottom) var(--vpad-left);
	}
	/* evenly spaced columns inside the plot area; non-interactive overlay */
	.vgrid-plot{
		position:absolute;
		left: var(--vpad-left);
		right: var(--vpad-right);
		top: var(--vpad-top);
		bottom: var(--vpad-bottom);
		display:grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		gap: var(--vbar-gap);
		pointer-events:none; /* critical: don't block sliders or other UI */
	}
	.vgrid-cell{display:flex;align-items:stretch;justify-content:center;}
	.vbar-area{position:relative;width:100%;height:100%;}
	.vbar{
		position:absolute; left:50%;
		transform:translateX(-50%);
		width: clamp(14px, 60%, 36px);
		border-radius:8px;
		box-shadow:inset 0 0 0 1px rgba(0,0,0,.06);
	}
	.vbar.pos{ bottom:50%; }   /* grow upward from centered baseline */
	.vbar.neg{ top:50%; }      /* grow downward from centered baseline */

	/* y-axis labels (outside plot) */
	.vchart-ylabels{
		position:absolute;
		left: 8px;
		top: var(--vpad-top);
		bottom: var(--vpad-bottom);
		display:flex; flex-direction:column; justify-content:space-between;
		font-size:.75rem; color:#64748b; pointer-events:none;
	}
	/* zero line exactly at middle of plot area */
	.vzero-hline{
		position:absolute;
		left: var(--vpad-left);
		right: var(--vpad-right);
		top: calc(var(--vpad-top) + ( (100% - var(--vpad-top) - var(--vpad-bottom)) / 2 ));
		height:2px; background:#94a3b8;
		transform: translateY(-50%);
		pointer-events:none;
	}

	/* captions grid below (normal flow) */
	.vgrid-x{
		display:grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		gap: var(--vbar-gap);
		margin-left: var(--vpad-left);
		margin-right: var(--vpad-right);
	}
	.vcol-caption{display:flex;flex-direction:column;align-items:center;gap:4px;}
	.vbar-label{max-width:88px; text-align:center; font-size:.8rem; color:#475569; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
	.vbar-value{font-size:.75rem; font-variant-numeric:tabular-nums; color:#334155;}
</style>
