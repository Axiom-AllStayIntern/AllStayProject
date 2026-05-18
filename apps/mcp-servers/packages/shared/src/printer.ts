import net from 'net';
import type { OrderPrintData } from './types.js';

const ESC = '\x1B';
const LF = '\x0A';
const INIT = `${ESC}@`;
const BOLD_ON = `${ESC}E\x01`;
const BOLD_OFF = `${ESC}E\x00`;
const CUT = `${ESC}d\x03${ESC}m`;

export async function printOrder(data: OrderPrintData): Promise<void> {
	const ip = process.env.PRINTER_IP ?? '192.168.1.100';
	const port = Number(process.env.PRINTER_PORT ?? 9100);

	let text = INIT;
	text += BOLD_ON + `ROOM ${data.roomId} — ORDER #${data.orderId}` + BOLD_OFF + LF;
	text += `Time: ${data.timestamp}` + LF;
	text += '--------------------------------' + LF;

	for (const item of data.items) {
		text += `${item.quantity}x ${item.name}` + LF;
		if (item.specialInstructions) {
			text += `   * ${item.specialInstructions}` + LF;
		}
		text += `   IDR ${item.price.toLocaleString()}` + LF;
	}

	text += '--------------------------------' + LF;
	text += BOLD_ON + `TOTAL: IDR ${data.total.toLocaleString()}` + BOLD_OFF + LF;
	text += CUT;

	await new Promise<void>((resolve, reject) => {
		const socket = net.createConnection({ host: ip, port }, () => {
			socket.write(text, 'binary', () => {
				socket.end();
				resolve();
			});
		});
		socket.on('error', reject);
		socket.setTimeout(5000, () => reject(new Error('Printer timeout')));
	});
}
