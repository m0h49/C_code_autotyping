document.addEventListener('DOMContentLoaded', function () {
    const codeEditor = document.getElementById('codeEditor');
    let typeInterval;
    let globalLineCounter = 1;
    const fileName = 'main.c';

    // Regex for C-like keywords.
    const cKeywords = [
        'auto', 'break', 'case', 'char', 'const', 'continue', 'default',
        'do', 'double', 'else', 'enum', 'extern', 'float', 'for', 'goto',
        'if', 'int', 'long', 'register', 'return', 'short', 'signed',
        'sizeof', 'static', 'struct', 'switch', 'typedef', 'union',
        'unsigned', 'void', 'volatile', 'while'
    ].join('|');
    const keywordRegex = new RegExp(`\\b(${cKeywords})\\b`, 'g');

    // Helper function to escape HTML characters.
    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Main function for C syntax highlighting.
     * This version uses a linear, stateful parser for improved accuracy and robustness.
     * @param {string} line - The line of code to highlight.
     * @param {boolean} isInMultiLineComment - Flag for being inside a multi-line comment.
     * @returns {Object} An object with the highlighted HTML and the new comment state.
     */
    function highlightLine(line, isInMultiLineComment) {
        let inCommentState = isInMultiLineComment;
        let content = '';
        const escapedLine = escapeHtml(line);
        let i = 0;

        // Handle preprocessor directives first, as they apply to the whole line.
        if (!inCommentState && escapedLine.trim().startsWith('#')) {
            return {
                html: `<span class="preprocessor">${escapedLine}</span>`,
                inComment: false
            };
        }

        while (i < escapedLine.length) {
            if (inCommentState) {
                const endCommentIndex = escapedLine.indexOf('*/', i);
                if (endCommentIndex !== -1) {
                    const commentPart = escapedLine.substring(i, endCommentIndex + 2);
                    content += `<span class="comment">${commentPart}</span>`;
                    inCommentState = false;
                    i = endCommentIndex + 2;
                } else {
                    const commentPart = escapedLine.substring(i);
                    content += `<span class="comment">${commentPart}</span>`;
                    break;
                }
            } else {
                const singleLineCommentIndex = escapedLine.indexOf('//', i);
                const multiCommentStartIndex = escapedLine.indexOf('/*', i);
                const stringStartIndex = escapedLine.indexOf('&quot;', i);

                // Determine the next token to process.
                let firstTokenIndex = -1;
                const indices = [singleLineCommentIndex, multiCommentStartIndex, stringStartIndex].filter(idx => idx !== -1);
                if (indices.length > 0) {
                    firstTokenIndex = Math.min(...indices);
                }

                // If no special tokens are left, process the rest of the line for keywords.
                if (firstTokenIndex === -1) {
                    let restOfLine = escapedLine.substring(i);
                    restOfLine = restOfLine.replace(keywordRegex, '<span class="keyword">$1</span>');
                    content += restOfLine;
                    break;
                }

                // Process the code before the token.
                let codePart = escapedLine.substring(i, firstTokenIndex);
                codePart = codePart.replace(keywordRegex, '<span class="keyword">$1</span>');
                content += codePart;
                i = firstTokenIndex;

                // Handle the token itself.
                if (i === stringStartIndex) {
                    const endStringIndex = escapedLine.indexOf('&quot;', i + 6);
                    if (endStringIndex !== -1) {
                        const stringPart = escapedLine.substring(i, endStringIndex + 6);
                        content += `<span class="string">${stringPart}</span>`;
                        i = endStringIndex + 6;
                    } else {
                        const stringPart = escapedLine.substring(i);
                        content += `<span class="string">${stringPart}</span>`;
                        break;
                    }
                } else if (i === multiCommentStartIndex) {
                    inCommentState = true;
                    // The loop will handle the comment content in the next iteration.
                } else if (i === singleLineCommentIndex) {
                    const commentPart = escapedLine.substring(i);
                    content += `<span class="comment">${commentPart}</span>`;
                    break;
                }
            }
        }

        return { html: content, inComment: inCommentState };
    }


    /**
     * Main function for the autotyping effect.
     * @param {string} content - The file content to autotype.
     */
    function startAutotyping(content) {
        if (!content) {
            content = [
                "/*",
                " * Multi-line comment",
                " * spanning multiple lines.",
                " */",
                "#include <stdio.h>",
                "",
                "// Single-line comment",
                "int main() {",
                "    // Using keywords like 'int' and 'return'",
                "    printf(\"Hello, World!\\n\"); /* inline comment */",
                "    return 0;",
                "}"
            ].join('\n');
        }

        codeEditor.innerHTML = '';
        globalLineCounter = 1;
        const sourceCode = content.split('\n');
        let currentLineIndex = 0;
        let currentCharIndex = 0;
        const maxLines = Math.floor(926 / 19); // Example value, adjust as needed
        let inMultiLineComment = false;

        function addChar() {
            if (currentLineIndex >= sourceCode.length) {
                clearInterval(typeInterval);
                setTimeout(() => startAutotyping(content), 2000);
                return;
            }

            const currentLineText = sourceCode[currentLineIndex];
            let currentLineElement;

            // Create the line element only once per line.
            if (currentCharIndex === 0) {
                const lineContainer = document.createElement('div');
                lineContainer.className = 'code-line';

                const lineNumber = document.createElement('span');
                lineNumber.className = 'line-number';
                lineNumber.textContent = globalLineCounter++;

                const codeContent = document.createElement('span');
                codeContent.className = 'code-content';

                const cursor = document.createElement('span');
                cursor.className = 'cursor';

                lineContainer.appendChild(lineNumber);
                lineContainer.appendChild(codeContent);
                lineContainer.appendChild(cursor);
                codeEditor.appendChild(lineContainer);

                if (codeEditor.children.length > maxLines) {
                    codeEditor.removeChild(codeEditor.firstChild);
                }
            }

            currentLineElement = codeEditor.lastChild;
            const codeContentElement = currentLineElement.querySelector('.code-content');
            const cursorElement = currentLineElement.querySelector('.cursor');

            if (currentCharIndex < currentLineText.length) {
                const textToShow = currentLineText.substring(0, currentCharIndex + 1);
                const result = highlightLine(textToShow, inMultiLineComment);
                // The inComment state is only finalized at the end of the line,
                // so we don't update the global state until then.
                codeContentElement.innerHTML = result.html;
                currentCharIndex++;
            } else {
                const result = highlightLine(currentLineText, inMultiLineComment);
                codeContentElement.innerHTML = result.html;
                inMultiLineComment = result.inComment; // Finalize state for the next line.
                // Remove cursor at the end of the line
                if (cursorElement) {
                    cursorElement.remove();
                }
                currentLineIndex++;
                currentCharIndex = 0;
            }
        }

        clearInterval(typeInterval);
        typeInterval = setInterval(addChar, 50);
    }

    fetch(fileName)
        .then(response => {
            if (!response.ok) {
                throw new Error('File not found');
            }
            return response.text();
        })
        .then(content => startAutotyping(content))
        .catch(() => {
            console.warn(`'${fileName}' not found. Using default code snippet.`);
            startAutotyping(); // Fallback to default content
        });
});