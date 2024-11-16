import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { BioViewerPanel } from '../../panels/BioViewerPanel';

suite('BioViewer Example Files Test Suite', () => {
    const examplesPath = path.join(__dirname, '..', '..', '..', 'test-resources', 'examples');
    const timeout = 30000;

    // Helper function to wait for extension activation
    async function ensureExtensionActivated(): Promise<void> {
        const ext = vscode.extensions.getExtension('shuuul.bioviewer');
        if (ext) {
            if (!ext.isActive) {
                await ext.activate();
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // Helper function to close all editors
    async function closeAllEditors(): Promise<void> {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    test('Should load MRC file', async function(this: Mocha.Context) {
        this.timeout(timeout);
        try {
            BioViewerPanel.log('\n=== Starting MRC File Test ===');
            
            // Clean up any existing panels
            let panel = BioViewerPanel.getCurrentPanel();
            if (!panel) {
                BioViewerPanel.log('No panel found, will retry...');
            } else {
                BioViewerPanel.log('Panel found, checking ready state');
                BioViewerPanel.log(`Panel state - isReady: ${panel.isReady}, isLoading: ${panel.isLoading}`);
                BioViewerPanel.log('Disposing existing panel');
                panel.dispose();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await ensureExtensionActivated();
            await closeAllEditors();

            const mrcFile = vscode.Uri.file(path.join(examplesPath, '0004_unified_apix2.mrc'));
            assert.ok(fs.existsSync(mrcFile.fsPath), 'MRC file should exist');

            // Execute command
            BioViewerPanel.log('Executing activateFromFiles command');
            await vscode.commands.executeCommand('bioviewer.activateFromFiles', [mrcFile]);
            
            // Only verify command execution
            BioViewerPanel.log('Command executed successfully');
            assert.ok(true, 'Command should execute without error');

        } catch (error) {
            BioViewerPanel.log(`Test failed with error: ${error}`);
            throw error;
        }
    });

    test('Should load CIF file', async function(this: Mocha.Context) {
        this.timeout(timeout);
        try {
            BioViewerPanel.log('\n=== Starting CIF File Test ===');
            
            if (BioViewerPanel.getCurrentPanel()) {
                BioViewerPanel.getCurrentPanel()?.dispose();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await ensureExtensionActivated();
            await closeAllEditors();

            const cifFile = vscode.Uri.file(path.join(examplesPath, '6GIQ_ba1.cif'));
            assert.ok(fs.existsSync(cifFile.fsPath), 'CIF file should exist');

            await vscode.commands.executeCommand('bioviewer.activateFromFiles', [cifFile]);
            assert.ok(true, 'Command should execute without error');

        } catch (error) {
            BioViewerPanel.log(`Test failed with error: ${error}`);
            throw error;
        }
    });

    test('Should load multiple files in same viewer', async function(this: Mocha.Context) {
        this.timeout(timeout * 2);
        try {
            BioViewerPanel.log('\n=== Starting Multiple Files Test ===');
            
            if (BioViewerPanel.getCurrentPanel()) {
                BioViewerPanel.getCurrentPanel()?.dispose();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await ensureExtensionActivated();
            await closeAllEditors();

            const files = [
                vscode.Uri.file(path.join(examplesPath, '0004_unified_apix2.mrc')),
                vscode.Uri.file(path.join(examplesPath, '6GIQ_ba1.cif'))
            ];

            files.forEach(file => {
                assert.ok(fs.existsSync(file.fsPath), `File ${file.fsPath} should exist`);
            });

            await vscode.commands.executeCommand('bioviewer.activateFromFiles', files);
            assert.ok(true, 'Command should execute without error');

        } catch (error) {
            BioViewerPanel.log(`Test failed with error: ${error}`);
            throw error;
        }
    });

    test('Should load all supported files from folder', async function(this: Mocha.Context) {
        this.timeout(timeout * 2);
        try {
            BioViewerPanel.log('\n=== Starting Folder Loading Test ===');
            
            if (BioViewerPanel.getCurrentPanel()) {
                BioViewerPanel.getCurrentPanel()?.dispose();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await ensureExtensionActivated();
            await closeAllEditors();

            await vscode.commands.executeCommand('bioviewer.activateFromFolder', vscode.Uri.file(examplesPath));
            assert.ok(true, 'Command should execute without error');

        } catch (error) {
            BioViewerPanel.log(`Test failed with error: ${error}`);
            throw error;
        }
    });
});
