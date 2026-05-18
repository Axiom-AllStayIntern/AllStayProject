<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { language } from '$lib/stores/language.js';

	// Accept any item shape with id, name, desc, price
	export let item: { id: string; name: Record<string, string>; desc: Record<string, string>; price: number } | null = null;
	export let open = false;

	const dispatch = createEventDispatcher<{
		add: { item: typeof item; quantity: number; specialInstructions: string };
		close: void;
	}>();

	let quantity = 1;
	let specialInstructions = '';
	$: lang = $language;

	$: if (open) { quantity = 1; specialInstructions = ''; }

	function fmtIDR(n: number) {
		return n.toLocaleString('en-US').replace(/,/g, ' ') + ' IDR';
	}

	function handleAdd() {
		if (!item) return;
		dispatch('add', { item, quantity, specialInstructions });
		dispatch('close');
	}

	const PH = { en: 'Special instructions...', zh: '特殊说明…' };
	const QTY_LBL = { en: 'Quantity', zh: '数量' };
	const ADD_LBL = { en: 'Add to Cart', zh: '加入购物车' };
</script>

{#if open && item}
	<!-- Mask -->
	<div class="sheet-mask" class:show={open} on:click={() => dispatch('close')} role="presentation"></div>

	<!-- Sheet -->
	<div class="sheet" class:show={open} role="dialog" aria-modal="true">
		<div class="grabber"></div>
		<div class="sheet-body">
			<!-- Placeholder image -->
			<div class="big-thumb">
				<span>{item.name.en ?? ''}</span>
			</div>

			<h3>{item.name[lang] ?? item.name.en}</h3>
			<p class="sheet-desc">{item.desc[lang] ?? item.desc.en}</p>

			<!-- Quantity row -->
			<div class="qty-row">
				<span class="lbl">{QTY_LBL[lang]}</span>
				<div class="qty">
					<button disabled={quantity <= 1} on:click={() => quantity--}>−</button>
					<span class="num">{quantity}</span>
					<button disabled={quantity >= 99} on:click={() => quantity++}>+</button>
				</div>
			</div>

			<!-- Special instructions -->
			<textarea
				class="instructions"
				placeholder={PH[lang]}
				bind:value={specialInstructions}
				rows="2"
			></textarea>

			<!-- CTA -->
			<div class="sheet-cta">
				<span class="total-prev">{fmtIDR(item.price * quantity)}</span>
				<button class="btn btn-primary" on:click={handleAdd}>
					{ADD_LBL[lang]}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.sheet-mask {
		position: fixed; inset: 0;
		background: rgba(15,26,48,.45);
		z-index: 80; opacity: 0; pointer-events: none;
		transition: opacity .25s;
	}
	.sheet-mask.show { opacity: 1; pointer-events: auto; }

	.sheet {
		position: fixed; left: 0; right: 0; bottom: 0;
		background: var(--cream); border-radius: 28px 28px 0 0;
		z-index: 81;
		transform: translateY(100%);
		transition: transform .3s cubic-bezier(.2,.8,.2,1);
		max-height: 86%;
		display: flex; flex-direction: column;
		box-shadow: 0 -24px 60px rgba(0,0,0,.25);
	}
	.sheet.show { transform: translateY(0); }

	.grabber {
		width: 40px; height: 4px; border-radius: 2px;
		background: var(--line-2);
		margin: 12px auto 0; flex-shrink: 0;
	}

	.sheet-body { padding: 16px 28px 32px; overflow-y: auto; }

	.big-thumb {
		width: 100%; height: 190px; border-radius: var(--r-lg);
		background: repeating-linear-gradient(135deg, var(--cream-2) 0 12px, var(--cream) 12px 24px);
		display: grid; place-items: center; color: var(--ink-3);
		font: 500 11px/1.4 var(--font-mono); text-align: center;
		border: 1px solid var(--line-2); margin-bottom: 20px;
	}

	h3 {
		margin: 4px 0 4px; font-family: var(--font-display);
		font-size: 28px; font-weight: 500;
	}
	.sheet-desc { color: var(--ink-2); font-size: 14px; line-height: 1.55; margin: 0 0 18px; }

	.qty-row {
		display: flex; align-items: center; justify-content: space-between;
		padding: 14px 0;
		border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
		margin-bottom: 18px;
	}
	.lbl { font-weight: 600; font-size: 14px; }
	.qty { display: flex; align-items: center; gap: 14px; }
	.qty button {
		width: 44px; height: 44px; border-radius: 50%;
		border: 1px solid var(--line); background: var(--white);
		font: 500 20px/1 var(--font-ui); color: var(--navy-800);
		cursor: pointer; display: grid; place-items: center;
		transition: all .15s;
	}
	.qty button:hover:not(:disabled) { border-color: var(--gold-500); color: var(--gold-600); }
	.qty button:active { transform: scale(.95); }
	.qty button:disabled { color: var(--ink-3); cursor: not-allowed; }
	.num { font-weight: 600; font-size: 18px; min-width: 28px; text-align: center; }

	.instructions {
		width: 100%; background: var(--white); border: 1px solid var(--line);
		border-radius: var(--r-md); padding: 14px 16px;
		font: 400 14px/1.5 var(--font-ui); color: var(--ink);
		resize: none; outline: none; min-height: 80px; margin-bottom: 18px;
	}
	.instructions:focus { border-color: var(--gold-400); }

	.sheet-cta {
		display: flex; align-items: center; justify-content: space-between; gap: 12px;
	}
	.sheet-cta .btn { flex: 1; }
	.total-prev {
		font-family: var(--font-display); font-size: 22px;
		font-weight: 500; color: var(--navy-800); white-space: nowrap;
	}
</style>
