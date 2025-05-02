import { Response } from 'express';

class NotificationManager {
  private static instance: NotificationManager;
  private clients: Set<Response>;

  private constructor() {
    this.clients = new Set();
  }

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  public addClient(client: Response): void {
    this.clients.add(client);
    console.log(`[NotificationManager] Client added. Total clients: ${this.clients.size}`);
  }

  public removeClient(client: Response): void {
    this.clients.delete(client);
    console.log(`[NotificationManager] Client removed. Total clients: ${this.clients.size}`);
  }

  public sendNotification(message: string): void {
    console.log(`[NotificationManager] Attempting to send notification to ${this.clients.size} clients:`, message);
    
    if (this.clients.size === 0) {
      console.log('[NotificationManager] No clients connected to send notification to');
      return;
    }

    let clientIndex = 0;
    let successCount = 0;
    let failureCount = 0;

    this.clients.forEach(client => {
      try {
        console.log(`[NotificationManager] Sending notification to client ${clientIndex + 1}`);
        
        // Ensure the message is properly formatted for SSE
        const sseMessage = `data: ${message}\n\n`;
        console.log(`[NotificationManager] SSE message format:`, sseMessage);
        
        // Check if client is still writable
        if (!client.writable || client.destroyed) {
          console.log(`[NotificationManager] Client ${clientIndex + 1} is not writable or destroyed, removing...`);
          this.removeClient(client);
          failureCount++;
          return;
        }
        
        // Send the message
        client.write(sseMessage, (error) => {
          if (error) {
            console.error(`[NotificationManager] Error writing to client ${clientIndex + 1}:`, error);
            this.removeClient(client);
            failureCount++;
          } else {
            console.log(`[NotificationManager] Successfully sent notification to client ${clientIndex + 1}`);
            successCount++;
          }
        });
        
        // Log client details in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`[NotificationManager] DEV: Client ${clientIndex + 1} details:`, {
            headers: client.getHeaders(),
            writable: client.writable,
            destroyed: client.destroyed,
            statusCode: client.statusCode
          });
        }
        
        clientIndex++;
      } catch (error) {
        console.error(`[NotificationManager] Error sending notification to client ${clientIndex + 1}:`, error);
        this.removeClient(client);
        failureCount++;
        clientIndex++;
      }
    });

    console.log(`[NotificationManager] Notification delivery summary:`, {
      totalClients: this.clients.size,
      successfulDeliveries: successCount,
      failedDeliveries: failureCount
    });
  }

  public getClientCount(): number {
    return this.clients.size;
  }
}

export const notificationManager = NotificationManager.getInstance(); 