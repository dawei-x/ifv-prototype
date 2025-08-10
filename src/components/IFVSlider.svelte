<script lang="ts">
  export let name = '';
  export let mu = 0.4;
  export let nu = 0.3;
  export let onUpdate: (data: { mu: number; nu: number; name: string }) => void;
  export let onRemove: () => void;

  // Snap helper: ensures the displayed μ, ν (two decimals) are exactly what we emit/calculate
  const snap2 = (x: number) => Math.round(x * 100) / 100;

  // Handle positions (0–100)
  $: leftHandlePos = mu * 100;
  $: rightHandlePos = (1 - nu) * 100;

  // Hesitation
  $: pi = Math.max(0, 1 - mu - nu);

  let isDragging: 'left' | 'right' | null = null;
  let sliderElement: HTMLDivElement;

  function startDragging(handle: 'left' | 'right') {
    isDragging = handle;
    document.body.classList.add('dragging');
  }

  function stopDragging() {
    isDragging = null;
    document.body.classList.remove('dragging');
  }

  function handleMouseDown(handle: 'left' | 'right') {
    startDragging(handle);
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isDragging || !sliderElement) return;
    const rect = sliderElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    updateByPosition(x, rect.width);
  }

  function handleMouseUp() {
    stopDragging();
  }

  // Touch support
  function handleTouchStart(_event: TouchEvent, handle: 'left' | 'right') {
    startDragging(handle);
  }

  function handleTouchMove(event: TouchEvent) {
    if (!isDragging || !sliderElement) return;
    const touch = event.touches[0];
    const rect = sliderElement.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    updateByPosition(x, rect.width);
  }

  function handleTouchEnd() {
    stopDragging();
  }

  function updateByPosition(x: number, width: number) {
    const percentage = Math.max(0, Math.min(100, (x / width) * 100));

    if (isDragging === 'left') {
      // Move μ
      let newMu = snap2(percentage / 100);

      // Enforce μ + ν ≤ 1 AFTER snapping
      if (newMu + nu > 1) {
        nu = snap2(Math.max(0, 1 - newMu));
      }
      mu = newMu;
    } else if (isDragging === 'right') {
      // Move ν
      let newNu = snap2((100 - percentage) / 100);

      // Enforce μ + ν ≤ 1 AFTER snapping
      if (mu + newNu > 1) {
        mu = snap2(Math.max(0, 1 - newNu));
      }
      nu = newNu;
    }

    emitChange(); // emits snapped values (exactly what you see)
  }

  function emitChange() {
    onUpdate({ mu, nu, name });
  }
</script>

<svelte:window
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
  on:touchmove={handleTouchMove}
  on:touchend={handleTouchEnd}
/>

<div class="ifv-slider">
  <input
    class="label-input"
    placeholder="Label"
    bind:value={name}
    on:input={emitChange}
  />

  <!-- Unified legend + values row -->
  <div class="values-legend" role="group" aria-label="IFV values">
    <div class="values-item">
      <span class="legend-dot membership" aria-hidden="true"></span>
      <span class="label">Membership (μ):</span>
      <span class="value">{mu.toFixed(2)}</span>
    </div>
    <div class="values-item">
      <span class="legend-dot hesitation" aria-hidden="true"></span>
      <span class="label">Hesitation (π):</span>
      <span class="value">{pi.toFixed(2)}</span>
    </div>
    <div class="values-item">
      <span class="legend-dot non-membership" aria-hidden="true"></span>
      <span class="label">Non-membership (ν):</span>
      <span class="value">{nu.toFixed(2)}</span>
    </div>
  </div>

  <div class="slider-container" bind:this={sliderElement}>
    <!-- Track -->
    <div class="slider-track"></div>

    <!-- μ fill (green) -->
    <div class="slider-fill membership" style="width: {leftHandlePos}%"></div>

    <!-- ν fill (red) -->
    <div class="slider-fill non-membership" style="width: {100 - rightHandlePos}%"></div>

    <!-- π fill (yellow) -->
    {#if rightHandlePos > leftHandlePos}
      <div
        class="slider-fill hesitation"
        style="left: {leftHandlePos}%; width: {rightHandlePos - leftHandlePos}%"
      ></div>
    {/if}

    <!-- Left handle (μ) -->
    <div
      class="slider-handle membership-handle"
      style="left: {leftHandlePos}%"
      on:mousedown={() => handleMouseDown('left')}
      on:touchstart={(e) => handleTouchStart(e, 'left')}
      role="slider"
      aria-label="Membership degree"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={mu}
      tabindex="0"
    ></div>

    <!-- Right handle (ν) -->
    <div
      class="slider-handle non-membership-handle"
      style="left: {rightHandlePos}%"
      on:mousedown={() => handleMouseDown('right')}
      on:touchstart={(e) => handleTouchStart(e, 'right')}
      role="slider"
      aria-label="Non-membership degree"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={nu}
      tabindex="0"
    ></div>
  </div>

  <button on:click={onRemove} class="remove-button">
    Remove
  </button>
</div>

<style>
  .ifv-slider {
    padding: 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    background: white;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .label-input {
    font-size: 1.125rem;
    font-weight: 600;
    width: 100%;
    padding: 0.25rem 0.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.25rem;
  }

  /* Unified values + legend row */
  .values-legend {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.4rem;
    font-size: 0.9rem;
    color: #475569; /* slate-600 */
  }

  @media (min-width: 560px) {
    .values-legend {
      grid-template-columns: repeat(3, 1fr);
      align-items: center;
    }
  }

  .values-item {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    white-space: nowrap;
  }

  .values-item .label {
    color: #64748b; /* slate-500 */
  }

  .values-item .value {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: #334155; /* slate-700 */
  }

  .legend-dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 0.125rem;
    display: inline-block;
  }
  .legend-dot.membership { background-color: #10b981; }
  .legend-dot.hesitation { background-color: #f59e0b; }
  .legend-dot.non-membership { background-color: #ef4444; }

  .slider-container {
    position: relative;
    height: 2rem;
    cursor: pointer;
  }

  .slider-track {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 100%;
    height: 0.3rem;
    background-color: #e5e7eb;
    border-radius: 0.25rem;
  }

  .slider-fill {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    height: 0.5rem;
  }

  .slider-fill.membership {
    left: 0;
    background-color: #10b981;
    border-radius: 0.25rem 0 0 0.25rem;
  }

  .slider-fill.non-membership {
    right: 0;
    background-color: #ef4444;
    border-radius: 0 0.25rem 0.25rem 0;
  }

  .slider-fill.hesitation {
    background-color: #f59e0b;
  }

  .slider-handle {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 1rem;
    height: 1rem;
    background-color: white;
    border-radius: 50%;
    cursor: ew-resize;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
    transition: transform 0.1s ease;
  }
  .slider-handle:hover { transform: translate(-50%, -50%) scale(1.1); }
  .slider-handle.membership-handle { border: 2px solid #10b981; }
  .slider-handle.non-membership-handle { border: 2px solid #ef4444; }

  .remove-button {
    font-size: 0.875rem;
    color: #ef4444;
    text-decoration: underline;
    background: none;
    border: none;
    cursor: pointer;
    align-self: flex-start;
  }
  .remove-button:hover { color: #dc2626; }

  /* Prevent text selection while dragging */
  :global(body.dragging) {
    user-select: none;
    -webkit-user-select: none;
  }
</style>
