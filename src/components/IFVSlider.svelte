<script lang="ts">
  export let name = '';
  export let mu = 0.4;
  export let nu = 0.3;
  export let onUpdate: (data: { mu: number; nu: number; name: string }) => void;
  export let onRemove: () => void;
  
  // Convert mu and nu to handle positions (0-100)
  $: leftHandlePos = mu * 100;
  $: rightHandlePos = (1 - nu) * 100;
  $: pi = Math.max(0, 1 - mu - nu);
  
  let isDragging: 'left' | 'right' | null = null;
  let sliderElement: HTMLDivElement;
  
  function handleMouseDown(handle: 'left' | 'right') {
    isDragging = handle;
  }
  
  function handleMouseMove(event: MouseEvent) {
    if (!isDragging || !sliderElement) return;
    
    const rect = sliderElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    
    if (isDragging === 'left') {
      // Moving left handle (membership)
      const newMu = percentage / 100;
      
      // If left handle would push right handle, move right handle too
      if (newMu + nu > 1) {
        nu = Math.max(0, 1 - newMu);
      }
      
      mu = newMu;
    } else {
      // Moving right handle (non-membership)
      const newNu = (100 - percentage) / 100;
      
      // If right handle would push left handle, move left handle too
      if (mu + newNu > 1) {
        mu = Math.max(0, 1 - newNu);
      }
      
      nu = newNu;
    }
    
    emitChange();
  }
  
  function handleMouseUp() {
    isDragging = null;
  }
  
  function emitChange() {
    onUpdate({ mu, nu, name });
  }
  
  // Touch support
  function handleTouchStart(event: TouchEvent, handle: 'left' | 'right') {
    isDragging = handle;
  }
  
  function handleTouchMove(event: TouchEvent) {
    if (!isDragging || !sliderElement) return;
    
    const touch = event.touches[0];
    const rect = sliderElement.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    
    if (isDragging === 'left') {
      const newMu = percentage / 100;
      if (newMu + nu > 1) {
        nu = Math.max(0, 1 - newMu);
      }
      mu = newMu;
    } else {
      const newNu = (100 - percentage) / 100;
      if (mu + newNu > 1) {
        mu = Math.max(0, 1 - newNu);
      }
      nu = newNu;
    }
    
    emitChange();
  }
  
  function handleTouchEnd() {
    isDragging = null;
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
  
  <div class="values-display">
    <span>μ: {mu.toFixed(2)}</span>
    <span>π: {pi.toFixed(2)}</span>
    <span>ν: {nu.toFixed(2)}</span>
  </div>
  
  <div class="slider-container" bind:this={sliderElement}>
    <!-- Background bar -->
    <div class="slider-track"></div>
    
    <!-- Membership degree (green) -->
    <div 
      class="slider-fill membership"
      style="width: {leftHandlePos}%"
    ></div>
    
    <!-- Non-membership degree (red) -->
    <div 
      class="slider-fill non-membership"
      style="width: {100 - rightHandlePos}%"
    ></div>
    
    <!-- Hesitation degree (yellow) -->
    {#if rightHandlePos > leftHandlePos}
    <div 
      class="slider-fill hesitation"
      style="left: {leftHandlePos}%; width: {rightHandlePos - leftHandlePos}%"
    ></div>
    {/if}
    
    <!-- Left handle (membership) -->
    <div
      class="slider-handle membership-handle"
      style="left: {leftHandlePos}%"
      on:mousedown={() => handleMouseDown('left')}
      on:touchstart={(e) => handleTouchStart(e, 'left')}
      role="slider"
      aria-label="Membership degree"
      aria-valuenow={mu}
      tabindex="0"
    ></div>
    
    <!-- Right handle (non-membership) -->
    <div
      class="slider-handle non-membership-handle"
      style="left: {rightHandlePos}%"
      on:mousedown={() => handleMouseDown('right')}
      on:touchstart={(e) => handleTouchStart(e, 'right')}
      role="slider"
      aria-label="Non-membership degree"
      aria-valuenow={nu}
      tabindex="0"
    ></div>
  </div>
  
  <!-- Legend -->
  <div class="legend">
    <span><span class="legend-dot membership"></span> Membership</span>
    <span><span class="legend-dot hesitation"></span> Hesitation</span>
    <span><span class="legend-dot non-membership"></span> Non-membership</span>
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
  
  .values-display {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    color: #6b7280;
  }
  
  .slider-container {
    position: relative;
    height: 3rem;
    cursor: pointer;
  }
  
  .slider-track {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 100%;
    height: 0.5rem;
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
  
  .slider-handle:hover {
    transform: translate(-50%, -50%) scale(1.1);
  }
  
  .slider-handle.membership-handle {
    border: 2px solid #10b981;
  }
  
  .slider-handle.non-membership-handle {
    border: 2px solid #ef4444;
  }
  
  .legend {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.5rem;
  }
  
  .legend span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .legend-dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 0.125rem;
    display: inline-block;
  }
  
  .legend-dot.membership {
    background-color: #10b981;
  }
  
  .legend-dot.hesitation {
    background-color: #f59e0b;
  }
  
  .legend-dot.non-membership {
    background-color: #ef4444;
  }
  
  .remove-button {
    font-size: 0.875rem;
    color: #ef4444;
    text-decoration: underline;
    background: none;
    border: none;
    cursor: pointer;
    align-self: flex-start;
  }
  
  .remove-button:hover {
    color: #dc2626;
  }
  
  /* Prevent text selection while dragging */
  :global(body.dragging) {
    user-select: none;
    -webkit-user-select: none;
  }
</style>