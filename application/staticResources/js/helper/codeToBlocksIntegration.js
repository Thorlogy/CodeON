/**
 * Code-to-Blocks Integration
 * This file provides the integration between the code editor and the code-to-blocks converter
 * without modifying the compiled progCode.controller.js
 */

// Wait for the page to load and the controllers to be initialized
(function () {
    'use strict';

    // Wait for jQuery and other dependencies to be available
    function waitForDependencies(callback) {
        if (typeof jQuery !== 'undefined' &&
            typeof Blockly !== 'undefined' &&
            typeof CodeToBlocksConverter !== 'undefined') {
            callback();
        } else {
            setTimeout(function () {
                waitForDependencies(callback);
            }, 100);
        }
    }

    waitForDependencies(function () {
        var $ = jQuery;

        // Add click handler for the Import to Blocks button
        $(document).ready(function () {
            // Use event delegation to handle the button click
            $(document).on('click', '#codeImportToBlocks', function (event) {
                console.log('[CODE-TO-BLOCKS] Import button clicked');
                event.stopPropagation();
                console.log('[CODE-TO-BLOCKS] Calling importCodeToBlocks()');
                importCodeToBlocks();
                console.log('[CODE-TO-BLOCKS] importCodeToBlocks() completed');
            });

            console.log('Code-to-Blocks integration loaded');
        });

        /**
         * Import Python code back to Blockly blocks
         */
        function importCodeToBlocks() {
            try {
                // Get the code from the Ace editor
                var editor = ace.edit('codeContent');
                var code = editor.getValue();

                // Create converter and convert to XML
                var converter = new CodeToBlocksConverter();
                var xml = converter.convertToXML(code);

                // Debug: Log the generated XML
                console.log('Generated XML:', xml);
                console.log('XML length:', xml.length);

                var dom = Blockly.Xml.textToDom(xml);

                // Get the workspace
                var workspace = Blockly.getMainWorkspace();

                // Find the start block (robControls_start) - it must be preserved
                var startBlock = null;
                var allBlocks = workspace.getAllBlocks();
                for (var i = 0; i < allBlocks.length; i++) {
                    if (allBlocks[i].type === 'robControls_start') {
                        startBlock = allBlocks[i];
                        break;
                    }
                }

                // Clear all blocks EXCEPT the start block
                // Use filter to create a safe copy before disposing
                var blocksToDispose = allBlocks.filter(function (block) {
                    return block.type !== 'robControls_start';
                });

                for (var i = 0; i < blocksToDispose.length; i++) {
                    try {
                        blocksToDispose[i].dispose();
                    } catch (e) {
                        console.error('Error disposing block:', e);
                    }
                }

                // Load new blocks from the converted XML
                Blockly.Xml.domToWorkspace(dom, workspace);

                // Find the newly added blocks by looking for top-level blocks that aren't the start block
                // (domToWorkspace in Open Roberta returns undefined, so we can't rely on its return value)
                var topBlocks = workspace.getTopBlocks(false);
                var firstConvertedBlock = null;

                for (var i = 0; i < topBlocks.length; i++) {
                    if (topBlocks[i].type !== 'robControls_start') {
                        firstConvertedBlock = topBlocks[i];
                        break;
                    }
                }

                // Connect the first converted block to the start block
                if (startBlock && firstConvertedBlock && startBlock.nextConnection) {
                    var previousConnection = firstConvertedBlock.previousConnection;
                    if (previousConnection && !previousConnection.isConnected()) {
                        startBlock.nextConnection.connect(previousConnection);
                    }
                }

                // Show success message
                if (typeof MSG !== 'undefined' && MSG.displayMessage) {
                    MSG.displayMessage('CODE_TO_BLOCKS_SUCCESS', 'TOAST', '');
                } else {
                    console.log('Code successfully converted to blocks');
                }

                // Close code panel
                $('#blocklyDiv').closeRightView();

            } catch (error) {
                console.error('Code to blocks conversion error:', error);
                if (typeof MSG !== 'undefined' && MSG.displayMessage) {
                    MSG.displayMessage('CODE_TO_BLOCKS_ERROR', 'POPUP', error.message || 'Conversion failed');
                } else {
                    alert('Conversion failed: ' + (error.message || 'Unknown error'));
                }
            }
        }

        // Make the function globally available for debugging
        window.importCodeToBlocks = importCodeToBlocks;
    });
})();
