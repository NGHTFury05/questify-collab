# Advanced Python Terminal

A sophisticated, AI-powered command-line interface with natural language processing, dynamic autocomplete, and beautiful UI.

## 🚀 Features

- **OpenRouter AI Integration**: Free LLM models for superior natural language understanding
- **Natural Language Processing**: Understand and execute commands written in plain English
- **Command History Sidebar**: Beautiful sidebar showing recent commands with timestamps
- **Dynamic Autocomplete**: Intelligent command suggestions with fuzzy matching
- **Rich UI**: Beautiful, colorful interface with tables, panels, and formatted output
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Security**: Built-in protection against dangerous commands
- **Statistics**: Session analytics and performance metrics
- **Extensible**: Easy to add new commands and natural language patterns

## 📦 Installation

### Option 1: Full Installation (with OpenRouter AI features)
```bash
pip install rich openai
```

### Option 2: Lightweight Installation (basic features)
```bash
pip install rich
```

### Option 3: Minimal Installation (no dependencies)
The terminal works without any external dependencies, but with reduced functionality.

### OpenRouter API Setup
1. Get a free API key from [OpenRouter](https://openrouter.ai/keys)
2. Set the environment variable:
   ```bash
   export OPENROUTER_API_KEY=your_api_key_here
   ```
   Or on Windows:
   ```cmd
   set OPENROUTER_API_KEY=your_api_key_here
   ```

## 🎯 Quick Start

### Run the Advanced Terminal (with AI)
```bash
python advanced_terminal.py
```

### Run the Simplified Terminal (lightweight)
```bash
python simple_advanced_terminal.py
```

## 💡 Usage Examples

### Natural Language Commands

The terminal understands natural language and converts it to appropriate commands:

```bash
🐍 $ show files
🧠 Interpreted: ls (confidence: 90%)
# Lists directory contents

🐍 $ create folder test
🧠 Interpreted: mkdir test (confidence: 90%)
# Creates a directory named 'test'

🐍 $ show file readme.txt
🧠 Interpreted: cat readme.txt (confidence: 90%)
# Displays the contents of readme.txt

🐍 $ clear screen
🧠 Interpreted: clear (confidence: 90%)
# Clears the terminal screen

🐍 $ go to documents
🧠 Interpreted: cd documents (confidence: 90%)
# Changes to the documents directory
```

### Standard Commands

All standard terminal commands work as expected:

```bash
🐍 $ ls -la
🐍 $ cd ..
🐍 $ mkdir new_project
🐍 $ git status
🐍 $ python script.py
🐍 $ pip install requests
```

### Special Commands

```bash
🐍 $ help          # Show comprehensive help
🐍 $ stats         # Display session statistics
🐍 $ history       # Show command history sidebar
🐍 $ suggest ls    # Get autocomplete suggestions
🐍 $ exit          # Exit the terminal
```

### Command History Sidebar

The terminal now features a beautiful sidebar showing your recent commands:

```bash
┌─ Main Terminal ───────────────────────┐ ┌─ Command History ──────────────────┐
│ 🐍 /home/user $ show files in test   │ │ 📜 Command History                 │
│ 🧠 Interpreted: ls test (95%)        │ │ 14:32:15 ✅ ls test                │
│ test/                                │ │ 14:32:10 ✅ cd /home               │
│                                      │ │ 14:32:05 ❌ rm -rf / (blocked)    │
│ 🐍 /home/user $ create folder backup │ │ 14:32:00 ✅ mkdir backup          │
│ 🧠 Interpreted: mkdir backup (95%)   │ │ 14:31:55 ✅ ls -la                 │
│                                      │ │                                    │
│ 🐍 /home/user $                      │ │                                    │
└──────────────────────────────────────┘ └────────────────────────────────────┘
```

## 🧠 Natural Language Patterns

The terminal recognizes these natural language patterns:

### File Operations
- "show files" → `ls` / `dir`
- "list all files" → `ls -la` / `dir /a`
- "show file [filename]" → `cat [filename]` / `type [filename]`
- "read file [filename]" → `cat [filename]` / `type [filename]`

### Directory Operations
- "go to [directory]" → `cd [directory]`
- "change to [directory]" → `cd [directory]`
- "create folder [name]" → `mkdir [name]`
- "make directory [name]" → `mkdir [name]`
- "show current directory" → `pwd` / `cd`

### System Operations
- "show processes" → `ps aux` / `tasklist`
- "list running programs" → `ps aux` / `tasklist`
- "clear screen" → `clear` / `cls`
- "clean terminal" → `clear` / `cls`

### Network Operations
- "ping [host]" → `ping [host]`
- "test connection to [host]" → `ping [host]`
- "download [url]" → `curl -O [url]`

### Search Operations
- "find [text] in [file]" → `grep "[text]" [file]` / `findstr "[text]" [file]`
- "search for files named [pattern]" → `find . -name "[pattern]"` / `where [pattern]`

## 🎨 Interface Features

### Rich UI Components
- **Welcome Panel**: Beautiful startup screen with system information
- **Command Tables**: Organized help display by categories
- **Colored Output**: Syntax highlighting and status indicators
- **Progress Indicators**: For long-running operations
- **Statistics Tables**: Session performance metrics

### Command Categories
- **File Operations**: ls, cd, mkdir, rm, cp, mv, cat
- **System**: ps, kill, top, ping, curl
- **Development**: git, python, node, npm, pip
- **Network**: ping, curl, wget

## 🔧 Configuration

### Adding Custom Commands

Edit the `_initialize_commands()` method to add new commands:

```python
("mycommand", "Description", "Category", 
 ["example1", "example2"], ["alias1", "alias2"])
```

### Adding Natural Language Patterns

Edit the `_initialize_patterns()` method to add new patterns:

```python
r"your regex pattern": {
    "command": "resulting command {0}"
}
```

### Customizing Aliases

Edit the `_initialize_aliases()` method:

```python
"alias": "actual_command"
```

## 🛡️ Security Features

The terminal includes built-in security measures:

- **Dangerous Command Detection**: Blocks potentially harmful commands
- **Pattern Matching**: Uses regex to identify risky operations
- **Safe Defaults**: Conservative approach to command execution
- **Timeout Protection**: Commands timeout after 30 seconds

### Blocked Patterns
- `rm -rf /`
- `del /s`
- `format`
- `shutdown`
- `dd if=`
- And more...

## 📊 Statistics and Analytics

Track your terminal usage with built-in analytics:

```bash
🐍 $ stats
```

Displays:
- Session duration
- Total commands executed
- Success rate
- Commands per minute
- Most used commands

## 🔍 Autocomplete Features

### Intelligent Suggestions
- **Prefix Matching**: Commands starting with your input
- **Fuzzy Matching**: Similar commands using difflib
- **Context Awareness**: Suggestions based on previous commands
- **Confidence Scoring**: Ranked suggestions with confidence levels

### Usage
- Press `Tab` for autocomplete
- Use `suggest [text]` for manual suggestions
- Autocomplete works for commands, files, and directories

## 🚨 Troubleshooting

### Common Issues

1. **Unicode Errors on Windows**
   - The terminal automatically handles UTF-8 encoding
   - If issues persist, try running in Windows Terminal or PowerShell

2. **Missing Dependencies**
   - Use `simple_advanced_terminal.py` for minimal dependencies
   - Install Rich for better UI: `pip install rich`

3. **Readline Not Available**
   - On Windows: `pip install pyreadline3`
   - Functionality works without readline, but with reduced features

4. **LLM Model Loading Issues**
   - Check internet connection for model download
   - Ensure sufficient disk space (models can be large)
   - Use simplified version if AI features aren't needed

### Performance Tips

1. **Faster Startup**: Use `simple_advanced_terminal.py` for quicker loading
2. **Memory Usage**: LLM models require significant RAM
3. **Network**: First run downloads models (requires internet)

## 🤝 Contributing

### Adding Features
1. Fork the repository
2. Create a feature branch
3. Add your enhancements
4. Test thoroughly
5. Submit a pull request

### Reporting Issues
- Provide system information
- Include error messages
- Describe steps to reproduce

## 📝 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- **Rich**: For beautiful terminal output
- **Transformers**: For natural language processing
- **Python Community**: For excellent libraries and tools

## 📞 Support

For support, questions, or feature requests:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the examples and documentation

---

**Happy Terminal-ing!** 🚀✨