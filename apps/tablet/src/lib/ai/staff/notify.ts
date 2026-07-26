// Staff notification — delivers a confirmed booking's work order to the SPA desk
// over multiple low-barrier channels (the "wrap, don't replace" last mile).
//
// Channels (all mock-friendly, all best-effort so a failure never affects the
// guest reply):
//   1. console  — structured server log (always).
//   2. print    — ESC/POS ticket over TCP if PRINTER_IP is set; else a no-op
//                 log. Mirrors the dining MCP's printer pattern.
//   3. store    — in-memory list powering the /staff viewer page.
//
// NOTE: the store is in-memory (single process) — consistent with the project's
// other demo-stage state (spaSession, spa-repo.takenSlots). For multi-instance
// production, back it with Redis (@allstay/shared/redis) keyed by property/desk.
// Swapping a real WhatsApp/Twilio adapter in place of the print channel is the
// only change needed to go live.

import { env } from '$env/dynamic/private';
import type { WorkOrder } from './work-order.js';

const MAX_ORDERS = 50;
const workOrders: WorkOrder[] = [];

/** Most-recent-first snapshot for the /staff page. */
export function listWorkOrders(): WorkOrder[] {
	return [...workOrders].reverse();
}

/** Mark a work order as confirmed by staff (the human-in-the-loop keystroke). */
export function markWorkOrderConfirmed(id: string): boolean {
	const wo = workOrders.find((w) => w.confirmationCode === id);
	if (!wo) return false;
	wo.status = 'confirmed';
	return true;
}

function pushToStore(order: WorkOrder): void {
	workOrders.push(order);
	if (workOrders.length > MAX_ORDERS) workOrders.splice(0, workOrders.length - MAX_ORDERS);
}

async function printTicket(order: WorkOrder): Promise<void> {
	const ip = env.PRINTER_IP;
	if (!ip) {
		console.info('[STAFF WORK ORDER][print] printer not configured — ticket not physically printed');
		return;
	}
	// Lazy-load node net so it never touches the client bundle.
	const net = await import('node:net');
	const ESC = '\x1B';
	const LF = '\x0A';
	const payload = `${ESC}@${order.bahasaText}${LF}${ESC}d\x03${ESC}m`;
	const port = Number(env.PRINTER_PORT ?? 9100);
	await new Promise<void>((resolve, reject) => {
		const socket = net.createConnection({ host: ip, port }, () => {
			socket.write(payload, 'binary', () => {
				socket.end();
				resolve();
			});
		});
		socket.on('error', reject);
		socket.setTimeout(5000, () => reject(new Error('Printer timeout')));
	});
}

/**
 * Deliver a work order to the SPA desk. Fire-and-forget: call as
 * `void notifyStaff(order)` from the booking success path — never awaited on
 * the guest's critical path, and each channel is isolated so one failing
 * (e.g. printer offline) doesn't break the others.
 */
export async function notifyStaff(order: WorkOrder): Promise<void> {
	// 1. console
	console.info(`[STAFF WORK ORDER]\n${order.bahasaText}`);

	// 2. store (for /staff viewer)
	try {
		pushToStore(order);
	} catch (e) {
		console.warn('[STAFF WORK ORDER][store] failed:', (e as Error).message);
	}

	// 3. print (best-effort)
	try {
		await printTicket(order);
	} catch (e) {
		console.warn('[STAFF WORK ORDER][print] skipped:', (e as Error).message);
	}
}
