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

	$: maxAbsRIQ = Math.max(...results.map((r) => Math.abs(r.riq)).filter((v) => !isNaN(v)), 1);

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

	// Using .map() for immutability is a safer pattern
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
</script>

<svelte:head>
	<title>IFV Decision Tool</title>
</svelte:head>

<main class="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
	<header class="space-y-2">
		<h1 class="text-3xl md:text-4xl font-bold text-slate-800">IFV Decision Support System Prototype</h1>
		<p class="text-lg text-slate-500">
			Adjust membership (μ) and non-membership (ν) degrees to specify candidate intuitionistic fuzzy values (IFVs). 
		</p>
	</header>

	<section class="card">
		<div class="flex justify-between items-center">
			<h2 class="text-xl font-semibold text-slate-700">Candidate Pool</h2>
			<button on:click={addIFV} class="btn btn-primary"> + Add Candidate </button>
		</div>

		<div class="space-y-4 pt-6">
			{#each ifvs as ifv (ifv.id)}
				<div transition:fade={{ duration: 250 }}>
					<IFVSlider
						bind:name={ifv.name}
						bind:mu={ifv.mu}
						bind:nu={ifv.nu}
						onUpdate={() => updateIFV(ifv.id, ifv)}
						onRemove={() => removeIFV(ifv.id)}
					/>
				</div>
			{/each}
		</div>

		{#if ifvs.length > 0}
			<div class="flex justify-end pt-6 mt-4 border-t">
				<button on:click={calculate} class="btn btn-secondary" class:btn-dirty={dirty}>
					{dirty ? 'Update Results' : 'Calculate'}
				</button>
			</div>
		{/if}
	</section>

	{#if results.length > 0}
		<section class="space-y-6" transition:fade>
			<h2 class="text-2xl font-semibold text-slate-800">Ranking Results</h2>
			{#if dirty}
				<div class="warning-banner" role="alert">
					<p>⚠️ The candidate values have changed.</p>
				</div>
			{/if}

			<div class="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
				<div class="card md:col-span-2">
					<h3 class="text-lg font-semibold text-slate-700">Ranking</h3>
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

				<div class="card md:col-span-3">
					<h3 class="text-lg font-semibold text-slate-700">Chart</h3>
					<div class="chart-grid">
						<div class="chart-grid-overlay">
							<div class="line h-line" />
							<div class="line v-line" style="left: 25%;" />
							<div class="line v-line" style="left: 75%;" />
							<div class="line zero-line" />
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
									<div
										class="bar {r.riq >= 0 ? 'positive' : 'negative'}"
										style="width: {Math.abs(percentage)}%;"
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
		--color-primary: #4f46e5; /* indigo-600 */
		--color-primary-hover: #4338ca; /* indigo-700 */
		--color-secondary: #16a34a; /* green-600 */
		--color-secondary-hover: #15803d; /* green-700 */
		--color-accent: #f97316; /* orange-500 */
		--color-accent-hover: #ea580c; /* orange-600 */
	}

	:global(body) {
		font-family: var(--font-sans);
		background-color: #f8fafc; /* slate-50 */
		color: #334155; /* slate-700 */
	}

	.card {
		background-color: white;
		border: 1px solid #e2e8f0; /* slate-200 */
		border-radius: 0.75rem;
		padding: 1.5rem;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.05);
	}

	.btn {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-weight: 600;
		color: white;
		border: none;
		transition: background-color 0.2s ease, transform 0.1s ease;
	}
	.btn:hover {
		transform: translateY(-1px);
	}
	.btn-primary {
		background-color: var(--color-primary);
	}
	.btn-primary:hover {
		background-color: var(--color-primary-hover);
	}
	.btn-secondary {
		background-color: var(--color-secondary);
	}
	.btn-secondary:hover {
		background-color: var(--color-secondary-hover);
	}
	.btn-dirty {
		background-color: var(--color-accent);
	}
	.btn-dirty:hover {
		background-color: var(--color-accent-hover);
	}

	/* Simple Zebra Striping for Table */
	.table-striped tr:nth-child(even) {
		background-color: #f8fafc; /* slate-50 */
	}
	td, th { border-color: #e2e8f0; /* slate-200 */ }


	/* Chart Styles from original code, slightly tweaked for consistency */
	.chart-grid {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.75rem 0;
		position: relative;
		padding-top: 2rem;
		margin-top: 1rem;
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
		color: #475569; /* slate-600 */
		white-space: nowrap;
		align-self: center;
	}
	.bar-area {
		grid-column: 2 / 3;
		position: relative;
		height: 1.75rem;
	}
	.line { position: absolute; background-color: #e2e8f0; /* slate-200 */ }
	.h-line { top: 50%; width: 100%; height: 1px; transform: translateY(-50%); }
	.v-line { top: -0.5rem; bottom: -0.5rem; width: 1px; }
	.zero-line { left: 50%; top: -0.5rem; bottom: -0.5rem; width: 2px; background-color: #94a3b8; /* slate-400 */ transform: translateX(-50%); }
	.scale-labels { position: absolute; top: -1.5rem; width: 100%; font-size: 0.75rem; color: #64748b; /* slate-500 */ }
	.scale-labels span { position: absolute; }

	.bar {
		position: absolute;
		top: 0;
		height: 100%;
		border-radius: 0.25rem;
		display: flex;
		align-items: center;
		color: white;
	}
	.bar.positive { left: 50%; background-color: #22c55e; justify-content: flex-end; padding-right: 0.5rem; }
	.bar.negative { right: 50%; background-color: #ef4444; justify-content: flex-start; padding-left: 0.5rem; }
	.bar-value { font-size: 0.75rem; font-weight: 600; color: rgba(255, 255, 255, 0.9); }

	.warning-banner {
		background-color: #fffbeb; /* yellow-50 */
		border: 1px solid #fde68a; /* yellow-300 */
		color: #b45309; /* yellow-700 */
		padding: 1rem;
		border-radius: 0.5rem;
		font-weight: 500;
	}
</style>