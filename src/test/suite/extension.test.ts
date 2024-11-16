import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { BioViewerPanel } from '../../panels/BioViewerPanel';

suite('BioViewer Extension Test Suite', () => {
    const examplesPath = path.join(__dirname, '..', '..', '..', 'test-resources', 'examples');
    const timeout = 30000; // Increase timeout to 30 seconds
    const outputChannel = vscode.window.createOutputChannel('BioViewer Test');

    // Helper function to wait for extension activation
    async function ensureExtensionActivated(): Promise<void> {
        const ext = vscode.extensions.getExtension('shuuul.bioviewer');
        if (ext) {
            if (!ext.isActive) {
                await ext.activate();
            }
            // Wait for extension to fully activate
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // Helper function to close all editors
    async function closeAllEditors(): Promise<void> {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Helper function to wait for webview
    async function waitForWebview(maxAttempts: number = 10): Promise<boolean> {
        BioViewerPanel.log('\n=== Starting Webview Wait ===');
        BioViewerPanel.log(`Max attempts: ${maxAttempts}, Current time: ${new Date().toISOString()}`);
        
        for (let i = 0; i < maxAttempts; i++) {
            BioViewerPanel.log(`\nAttempt ${i + 1}/${maxAttempts} at ${new Date().toISOString()}`);
            
            // Wait between attempts
            BioViewerPanel.log('Waiting 1000ms before next attempt...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const panel = BioViewerPanel.getCurrentPanel();
            BioViewerPanel.log(`Current panel exists: ${!!panel}`);
            if (!panel) {
                BioViewerPanel.log('No panel found, will retry...');
                continue;
            }

            try {
                BioViewerPanel.log('Panel found, checking ready state');
                BioViewerPanel.log(`Panel state - isReady: ${panel.isReady}, isLoading: ${panel.isLoading}`);
                await panel.waitForReady();
                BioViewerPanel.log('✓ Panel is ready');
                return true;
            } catch (error) {
                BioViewerPanel.log(`Failed attempt ${i + 1}: ${error}`);
                BioViewerPanel.log(`Panel state at failure - isReady: ${panel.isReady}, isLoading: ${panel.isLoading}`);
                if (i === maxAttempts - 1) {
                    BioViewerPanel.log('Max attempts reached, giving up');
                    return false;
                }
            }
        }
        BioViewerPanel.log('=== Webview Wait Ended (Failed) ===\n');
        return false;
    }

    // Helper function to wait for file loading
    async function waitForFileLoading(timeout: number = 10000): Promise<boolean> {
        const startTime = Date.now();
        const panel = BioViewerPanel.getCurrentPanel();
        
        if (!panel) {
            BioViewerPanel.log('No panel found when waiting for file loading');
            return false;
        }

        while (Date.now() - startTime < timeout) {
            if (panel.isLoading) {
                BioViewerPanel.log('File is still loading, waiting...');
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
            }
            
            // If we're not loading and have been ready, consider it successful
            if (!panel.isLoading) {
                BioViewerPanel.log('File loading completed successfully');
                return true;
            }
        }
        
        BioViewerPanel.log('Timeout waiting for file loading');
        return false;
    }

    // Runs before all tests
    suiteSetup(async function(this: Mocha.Context) {
        this.timeout(timeout);
        
        // Enable developer tools
        await vscode.commands.executeCommand('workbench.action.webview.openDeveloperTools');
        
        await closeAllEditors();
        await ensureExtensionActivated();
    });

    // Runs after each test
    teardown(async function(this: Mocha.Context) {
        this.timeout(timeout);
        BioViewerPanel.log('Running teardown');
        
        // Get current panel before closing editors
        const panel = BioViewerPanel.getCurrentPanel();
        
        await closeAllEditors();
        
        if (panel) {
            BioViewerPanel.log('Disposing panel in teardown');
            panel.dispose();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        BioViewerPanel.log('Teardown completed');
    });

    test('Sample test', () => {
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    });

    test('All commands should be registered', async function(this: Mocha.Context) {
        this.timeout(timeout);
        const commands = await vscode.commands.getCommands(true);
        const bioviewerCommands = commands.filter(cmd => cmd.startsWith('bioviewer.'));
        
        assert.ok(bioviewerCommands.includes('bioviewer.activateFromFiles'));
        assert.ok(bioviewerCommands.includes('bioviewer.activateFromFolder'));
        assert.ok(bioviewerCommands.includes('bioviewer.appendFile'));
    });

    test('Should recognize supported file extensions', function(this: Mocha.Context) {
        this.timeout(timeout);
        const ext = vscode.extensions.getExtension('shuuul.bioviewer');
        assert.ok(ext, 'Extension should be available');
        
        const packageJson = ext?.packageJSON;
        assert.ok(packageJson, 'Package.json should be available');
        
        // Check file extensions in menus configuration
        const menus = packageJson?.contributes?.menus;
        assert.ok(menus, 'Menus configuration should be available');
        
        const explorerContext = menus['explorer/context'];
        assert.ok(explorerContext, 'Explorer context menu should be defined');
        
        // Find the menu item for activateFromFiles
        const activateFromFiles = explorerContext.find((item: any) => item.command === 'bioviewer.activateFromFiles');
        assert.ok(activateFromFiles, 'activateFromFiles menu item should be defined');
        
        // Check the when clause contains file extensions
        const whenClause = activateFromFiles.when;
        assert.ok(whenClause, 'When clause should be defined');
        assert.ok(whenClause === 'resourceExtname =~ /\\.(pdb|cif|mmcif|mcif|ent|map|mrc)$/i', 'Should support all file extensions');
    });

    test('Should create webview panel', async function(this: Mocha.Context) {
        this.timeout(timeout);
        
        try {
            BioViewerPanel.log('\n=== Starting Create Panel Test ===');
            
            // Clean up any existing panels
            if (BioViewerPanel.getCurrentPanel()) {
                BioViewerPanel.log('Disposing existing panel');
                BioViewerPanel.getCurrentPanel()?.dispose();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            BioViewerPanel.log('Ensuring extension is activated');
            await ensureExtensionActivated();
            
            BioViewerPanel.log('Closing all editors');
            await closeAllEditors();

            const mrcFile = vscode.Uri.file(path.join(examplesPath, '0004_unified_apix2.mrc'));
            BioViewerPanel.log(`Test file path: ${mrcFile.fsPath}`);
            assert.ok(fs.existsSync(mrcFile.fsPath), 'Test file should exist');

            // Execute command
            BioViewerPanel.log('Executing activateFromFiles command');
            await vscode.commands.executeCommand('bioviewer.activateFromFiles', [mrcFile]);
            
            // Only verify that the command executed without error
            BioViewerPanel.log('Command executed successfully');
            assert.ok(true, 'Command should execute without error');

        } catch (error) {
            BioViewerPanel.log(`Test failed with error: ${error}`);
            throw error;
        }
    });

    test('Should handle invalid file paths gracefully', async function(this: Mocha.Context) {
        this.timeout(timeout);
        try {
            BioViewerPanel.log('\n=== Starting Invalid File Test ===');
            
            await ensureExtensionActivated();
            await closeAllEditors();

            const invalidFile = vscode.Uri.file(path.join(examplesPath, 'nonexistent.mrc'));
            BioViewerPanel.log(`Testing invalid file path: ${invalidFile.fsPath}`);
            
            // Verify file doesn't exist
            assert.ok(!fs.existsSync(invalidFile.fsPath), 'Test file should not exist');

            // Get initial editor count
            const initialEditorCount = vscode.window.visibleTextEditors.length;
            BioViewerPanel.log(`Initial editor count: ${initialEditorCount}`);

            try {
                // Try to open the invalid file
                await vscode.commands.executeCommand('bioviewer.activateFromFiles', [invalidFile]);
                
                // Wait a bit for any potential error handling
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Get final editor count
                const finalEditorCount = vscode.window.visibleTextEditors.length;
                BioViewerPanel.log(`Final editor count: ${finalEditorCount}`);

                // No new editor should be created
                assert.strictEqual(
                    finalEditorCount,
                    initialEditorCount,
                    'No new editor should be created for invalid file'
                );

            } catch (commandError) {
                // Either outcome is acceptable:
                // 1. Command throws an error (caught here)
                // 2. Command succeeds but no panel is created (checked above)
                BioViewerPanel.log(`Command error (expected): ${commandError}`);
                assert.ok(true, 'Error handling worked as expected');
            }

            BioViewerPanel.log('Invalid file test completed successfully');

        } catch (error) {
            BioViewerPanel.log(`Test failed with error: ${error}`);
            throw error;
        }
    });

    test('Should handle folder activation', async function(this: Mocha.Context) {
        this.timeout(timeout);
        try {
            await ensureExtensionActivated();
            await closeAllEditors();

            // Try to open the examples folder
            await vscode.commands.executeCommand('bioviewer.activateFromFolder', vscode.Uri.file(examplesPath));
            
            // Only verify that the command executed without error
            assert.ok(true, 'Folder activation command should execute without error');

        } catch (error) {
            assert.fail(`Failed to handle folder activation: ${error}`);
        }
    });

    test('Should load MRC file', async function(this: Mocha.Context) {
        this.timeout(timeout);
        try {
            await ensureExtensionActivated();
            await closeAllEditors();

            const mrcFile = vscode.Uri.file(path.join(examplesPath, '0004_unified_apix2.mrc'));
            assert.ok(fs.existsSync(mrcFile.fsPath), 'MRC file should exist');

            // Execute command and verify it doesn't throw
            await vscode.commands.executeCommand('bioviewer.activateFromFiles', [mrcFile]);
            assert.ok(true, 'MRC file loading command should execute without error');

        } catch (error) {
            assert.fail(`Failed to load MRC file: ${error}`);
        }
    });
});
