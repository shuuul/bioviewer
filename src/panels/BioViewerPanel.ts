import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';

/**
 * BioViewerPanel manages the webview panel for displaying biological structures
 * using the Mol* viewer. It handles panel creation, content loading, and
 * communication between the extension and the webview.
 */
export class BioViewerPanel {
  /** The currently active BioViewer panel */
  public static currentPanel: BioViewerPanel | undefined;
  
  /** The underlying VS Code webview panel */
  private readonly _panel: vscode.WebviewPanel;
  
  /** Array of disposables to clean up when panel is disposed */
  private _disposables: vscode.Disposable[] = [];
  
  /** Output channel for logging (shared across all instances) */
  private static _outputChannel: vscode.OutputChannel;
  
  /** Promise that resolves when the webview is ready to receive messages */
  private _readyPromise: Promise<void>;
  
  /** Resolver function for the ready promise */
  private _resolveReady: (() => void) | undefined;
  
  /** Flag indicating if the webview is ready */
  private _isReady: boolean = false;
  
  /** Flag indicating if content is currently loading */
  private _isLoading: boolean = false;

  /**
   * Static logging method for testing and debugging
   * @param message - The message to log
   */
  public static log(message: string) {
    if (BioViewerPanel._outputChannel) {
      BioViewerPanel._outputChannel.appendLine(message);
    }
  }

  /**
   * Gets the ready state of the panel (for testing)
   * @returns True if the webview is ready to receive messages
   */
  public get isReady(): boolean {
    return this._isReady;
  }

  /**
   * Gets the loading state of the panel (for testing)
   * @returns True if content is currently being loaded
   */
  public get isLoading(): boolean {
    return this._isLoading;
  }

  /**
   * Private constructor - use static create() method instead
   * @param panel - The VS Code webview panel
   * @param extensionUri - The extension's URI for resource loading
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    const startTime = Date.now();
    BioViewerPanel._outputChannel.appendLine(`[Constructor] Initializing BioViewerPanel: ${panel.title}`);
    
    this._panel = panel;
    
    // Set up panel disposal handling
    this._panel.onDidDispose(() => {
      BioViewerPanel._outputChannel.appendLine(`[Dispose] Panel ${panel.title} is being disposed`);
      this.dispose();
    }, null, this._disposables);
    
    // Initialize ready promise for synchronizing webview readiness
    this._readyPromise = new Promise((resolve) => {
      this._resolveReady = resolve;
      BioViewerPanel._outputChannel.appendLine(`[Constructor] Ready promise initialized`);
    });

    // Set up message handling from webview
    this._setupMessageHandling();

    // Generate and set the webview HTML content
    this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);
    BioViewerPanel._outputChannel.appendLine(`[Constructor] Panel initialization completed in ${Date.now() - startTime}ms`);
  }

  /**
   * Sets up message handling between the extension and webview
   */
  private _setupMessageHandling(): void {
    this._panel.webview.onDidReceiveMessage(
      message => {
        BioViewerPanel._outputChannel.appendLine(`[Message] Received: ${JSON.stringify(message)}`);
        
        // Check if message has a command property
        if (!message.command) {
          BioViewerPanel._outputChannel.appendLine(`[Message] Warning: Message received without command property: ${JSON.stringify(message)}`);
          return;
        }
        
        switch (message.command) {
          case 'ready':
            BioViewerPanel._outputChannel.appendLine(`[Message] Webview is ready`);
            this._handleReady();
            BioViewerPanel.currentPanel = this;
            break;
            
          case 'error':
            BioViewerPanel._outputChannel.appendLine(`[Message] Error from webview: ${message.error}`);
            vscode.window.showErrorMessage(`BioViewer: ${message.error}`);
            break;
            
          case 'info':
            BioViewerPanel._outputChannel.appendLine(`[Message] Info from webview: ${message.info}`);
            break;
            
          default:
            BioViewerPanel._outputChannel.appendLine(`[Message] Unknown command: ${message.command}`);
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Handles the 'ready' message from the webview
   * Resolves the ready promise to allow content loading
   */
  private _handleReady(): void {
    this._isReady = true;
    BioViewerPanel._outputChannel.appendLine('Webview is ready for content loading');
    
    if (this._resolveReady) {
      this._resolveReady();
      this._resolveReady = undefined;
    }
  }

  /**
   * Waits for the webview to be ready before proceeding
   * @returns Promise that resolves when webview is ready
   */
  public async waitForReady(): Promise<void> {
    if (this._isReady) {
      return Promise.resolve();
    }
    return this._readyPromise;
  }

  /**
   * Creates a new BioViewer panel instance
   * @param extensionUri - The extension's URI for resource loading
   * @param title - The title for the panel (default: "BioViewer")
   * @param outputChannel - The output channel for logging
   * @returns New BioViewerPanel instance
   */
  public static create(extensionUri: vscode.Uri, title: string = "BioViewer", outputChannel: vscode.OutputChannel): BioViewerPanel {
    const startTime = Date.now();
    BioViewerPanel._outputChannel = outputChannel;
    BioViewerPanel._outputChannel.appendLine(`[Create] Creating new BioViewerPanel`);
    BioViewerPanel._outputChannel.appendLine(`[Create] Title: ${title}`);
    
    // Determine the column to place the panel
    const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;
    
    BioViewerPanel._outputChannel.appendLine(`[Create] Using view column: ${column}`);

    // Create the webview panel with appropriate options
    const panel = vscode.window.createWebviewPanel(
      "BioViewer",
      title,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'resources')
        ]
      }
    );
    
    const instance = new BioViewerPanel(panel, extensionUri);
    BioViewerPanel._outputChannel.appendLine(`[Create] BioViewerPanel created in ${Date.now() - startTime}ms`);
    return instance;
  }

  /**
   * Gets the currently active BioViewer panel
   * @returns The current panel instance or undefined if none exists
   */
  public static getCurrentPanel(): BioViewerPanel | undefined {
    return BioViewerPanel.currentPanel;
  }

  /**
   * Loads content into the BioViewer by sending a command to the webview
   * @param command - The command to execute in the webview
   * @param params - Parameters for the command
   */
  public loadContent(command: string, params: any): void {
    BioViewerPanel._outputChannel.appendLine(`[LoadContent] Command: ${command}`);
    // Log parameters without the data content to avoid spam
    const logParams = { ...params };
    if (logParams.data) {
      logParams.data = `[${logParams.isBinary ? 'Binary' : 'Text'} content: ${logParams.data.length} chars]`;
    }
    BioViewerPanel._outputChannel.appendLine(`[LoadContent] Parameters: ${JSON.stringify(logParams, null, 2)}`);
    
    if (!this._isReady) {
      BioViewerPanel._outputChannel.appendLine(`[LoadContent] Warning: Webview may not be ready yet`);
    }
    
    try {
      this._isLoading = true;
      this._panel.webview.postMessage({ command, ...params });
      BioViewerPanel._outputChannel.appendLine(`[LoadContent] Message sent successfully`);
    } catch (error) {
      this._isLoading = false;
      const errorMsg = `Failed to send message to webview: ${error}`;
      BioViewerPanel._outputChannel.appendLine(`[LoadContent] Error: ${errorMsg}`);
      vscode.window.showErrorMessage(`BioViewer: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Disposes of the panel and cleans up resources
   */
  public dispose(): void {
    BioViewerPanel._outputChannel.appendLine(`[Dispose] Disposing BioViewerPanel: ${this._panel.title}`);
    
    // Clear the current panel reference if this is the current panel
    if (BioViewerPanel.currentPanel === this) {
      BioViewerPanel.currentPanel = undefined;
    }
    
    // Dispose of the panel
    this._panel.dispose();
    
    // Clean up all disposables
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
    
    BioViewerPanel._outputChannel.appendLine(`[Dispose] Cleanup completed`);
  }

  /**
   * Generates the HTML content for the webview
   * @param webview - The webview instance
   * @param extensionUri - The extension's URI for resource loading
   * @returns The complete HTML content for the webview
   */
  private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const startTime = Date.now();
    BioViewerPanel._outputChannel.appendLine(`[GetWebviewContent] Generating webview content`);
    
    try {
      // Read the HTML template
      const htmlPath = path.join(extensionUri.fsPath, 'dist', 'webview', 'bioviewer.html');
      BioViewerPanel._outputChannel.appendLine(`[GetWebviewContent] Reading HTML template from: ${htmlPath}`);
      
      let htmlContent = fs.readFileSync(htmlPath, 'utf8');
      BioViewerPanel._outputChannel.appendLine(`[GetWebviewContent] HTML template loaded successfully`);

      // Generate URIs for resources
      const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'molstar', 'molstar.css'));
      const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'molstar', 'molstar.js'));
      const nonce = this._generateNonce();

      BioViewerPanel._outputChannel.appendLine(`[GetWebviewContent] Resources prepared`);
      BioViewerPanel._outputChannel.appendLine(`  CSS: ${cssUri}`);
      BioViewerPanel._outputChannel.appendLine(`  JS: ${jsUri}`);

      // Replace placeholders with actual URIs and security nonce
      htmlContent = htmlContent
        .replace(/\$\{cssUri\}/g, cssUri.toString())
        .replace(/\$\{jsUri\}/g, jsUri.toString())
        .replace(/\$\{nonce\}/g, nonce);

      BioViewerPanel._outputChannel.appendLine(`[GetWebviewContent] Content generated in ${Date.now() - startTime}ms`);
      return htmlContent;
    } catch (error) {
      const errorMsg = `Failed to generate webview content: ${error}`;
      BioViewerPanel._outputChannel.appendLine(`[GetWebviewContent] Error: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Generates a random nonce for Content Security Policy
   * @returns A random 32-character string
   */
  private _generateNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Converts a file URI to a webview URI for loading resources
   * @param uri - The file URI to convert
   * @returns The webview URI
   */
  public getWebviewUri(uri: vscode.Uri): vscode.Uri {
    return this._panel.webview.asWebviewUri(uri);
  }
}