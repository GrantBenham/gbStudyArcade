using System;
using System.IO;
using System.IO.Compression;
using System.Security;
using System.Text;
using System.Windows.Forms;

namespace ScormBuilderTool
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new BuilderForm());
        }
    }

    internal sealed class BuilderForm : Form
    {
        private readonly TextBox _projectFolderText = new TextBox();
        private readonly TextBox _termsFileText = new TextBox();
        private readonly TextBox _outputZipText = new TextBox();
        private readonly TextBox _activityTitleText = new TextBox();
        private readonly TextBox _packageIdText = new TextBox();
        private readonly Label _statusLabel = new Label();

        internal BuilderForm()
        {
            Text = "Study Arcade SCORM Builder";
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new System.Drawing.Size(900, 560);
            Width = 980;
            Height = 620;

            var root = new TableLayoutPanel();
            root.Dock = DockStyle.Fill;
            root.ColumnCount = 1;
            root.RowCount = 3;
            root.Padding = new Padding(14);
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            Controls.Add(root);

            var guidance = new Label();
            guidance.Dock = DockStyle.Top;
            guidance.AutoSize = true;
            guidance.MaximumSize = new System.Drawing.Size(920, 0);
            guidance.Text =
                "Build a Brightspace-ready SCORM 1.2 zip for Study Arcade.\r\n" +
                "1) Choose the project folder containing index.html/app.js/styles.css.\r\n" +
                "2) Choose which terms file to package (it will be renamed to terms.txt inside the zip).\r\n" +
                "3) Set Activity Title (this is the Brightspace-visible activity name from the SCORM manifest).\r\n" +
                "4) Set output zip name and click Build SCORM Package.";
            root.Controls.Add(guidance, 0, 0);

            var fields = new TableLayoutPanel();
            fields.Dock = DockStyle.Fill;
            fields.ColumnCount = 3;
            fields.RowCount = 6;
            fields.Padding = new Padding(0, 12, 0, 0);
            fields.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 180));
            fields.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            fields.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 125));
            for (var i = 0; i < 6; i += 1)
            {
                fields.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            }
            root.Controls.Add(fields, 0, 1);

            AddFileRow(fields, 0, "Project Folder", _projectFolderText, "Browse...", BrowseProjectFolder);
            AddFileRow(fields, 1, "Terms Source File", _termsFileText, "Browse...", BrowseTermsFile);
            AddFileRow(fields, 2, "Output Zip", _outputZipText, "Browse...", BrowseOutputZip);
            AddTextRow(fields, 3, "Activity Title", _activityTitleText);
            AddTextRow(fields, 4, "Package Identifier", _packageIdText);

            var note = new Label();
            note.Dock = DockStyle.Top;
            note.AutoSize = true;
            note.Padding = new Padding(0, 8, 0, 0);
            note.MaximumSize = new System.Drawing.Size(920, 0);
            note.Text =
                "Tip: Any selected terms file is packed as terms.txt inside the SCORM zip.\r\n" +
                "GitHub Pages behavior is unaffected. This only builds a course-package zip.";
            fields.Controls.Add(note, 0, 5);
            fields.SetColumnSpan(note, 3);

            var actions = new FlowLayoutPanel();
            actions.Dock = DockStyle.Fill;
            actions.AutoSize = true;
            actions.FlowDirection = FlowDirection.LeftToRight;
            actions.Padding = new Padding(0, 8, 0, 0);
            root.Controls.Add(actions, 0, 2);

            var buildButton = new Button();
            buildButton.Text = "Build SCORM Package";
            buildButton.AutoSize = true;
            buildButton.Padding = new Padding(14, 6, 14, 6);
            buildButton.Click += delegate { BuildPackage(); };
            actions.Controls.Add(buildButton);

            var openFolderButton = new Button();
            openFolderButton.Text = "Open Project Folder";
            openFolderButton.AutoSize = true;
            openFolderButton.Padding = new Padding(14, 6, 14, 6);
            openFolderButton.Click += delegate
            {
                var folder = _projectFolderText.Text.Trim();
                if (Directory.Exists(folder))
                {
                    System.Diagnostics.Process.Start(folder);
                }
            };
            actions.Controls.Add(openFolderButton);

            _statusLabel.AutoSize = true;
            _statusLabel.Padding = new Padding(14, 12, 0, 0);
            _statusLabel.Text = "Status: Ready.";
            actions.Controls.Add(_statusLabel);

            InitializeDefaults();
        }

        private static void AddFileRow(TableLayoutPanel table, int row, string labelText, TextBox textBox, string buttonText, Action onBrowse)
        {
            var label = new Label();
            label.Text = labelText;
            label.AutoSize = true;
            label.Anchor = AnchorStyles.Left;
            label.Margin = new Padding(0, 8, 8, 8);
            table.Controls.Add(label, 0, row);

            textBox.Dock = DockStyle.Fill;
            textBox.Margin = new Padding(0, 4, 8, 4);
            table.Controls.Add(textBox, 1, row);

            var browse = new Button();
            browse.Text = buttonText;
            browse.AutoSize = true;
            browse.Anchor = AnchorStyles.Left;
            browse.Click += delegate { onBrowse(); };
            table.Controls.Add(browse, 2, row);
        }

        private static void AddTextRow(TableLayoutPanel table, int row, string labelText, TextBox textBox)
        {
            var label = new Label();
            label.Text = labelText;
            label.AutoSize = true;
            label.Anchor = AnchorStyles.Left;
            label.Margin = new Padding(0, 8, 8, 8);
            table.Controls.Add(label, 0, row);

            textBox.Dock = DockStyle.Fill;
            textBox.Margin = new Padding(0, 4, 8, 4);
            table.Controls.Add(textBox, 1, row);
            table.SetColumnSpan(textBox, 2);
        }

        private void InitializeDefaults()
        {
            var baseDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            _projectFolderText.Text = baseDir;
            var defaultTerms = Path.Combine(baseDir, "terms.txt");
            _termsFileText.Text = File.Exists(defaultTerms) ? defaultTerms : string.Empty;
            _outputZipText.Text = Path.Combine(baseDir, "gbStudyArcade-scorm12.zip");
            _activityTitleText.Text = "Study Arcade";
            _packageIdText.Text = "gbStudyArcade_SCORM12";
        }

        private void BrowseProjectFolder()
        {
            using (var dialog = new FolderBrowserDialog())
            {
                dialog.Description = "Select the folder that contains index.html, app.js, and styles.css";
                dialog.SelectedPath = Directory.Exists(_projectFolderText.Text) ? _projectFolderText.Text : AppContext.BaseDirectory;
                if (dialog.ShowDialog(this) != DialogResult.OK)
                {
                    return;
                }

                _projectFolderText.Text = dialog.SelectedPath;
                var defaultTerms = Path.Combine(dialog.SelectedPath, "terms.txt");
                if (File.Exists(defaultTerms))
                {
                    _termsFileText.Text = defaultTerms;
                }
                _outputZipText.Text = Path.Combine(dialog.SelectedPath, "gbStudyArcade-scorm12.zip");
            }
        }

        private void BrowseTermsFile()
        {
            using (var dialog = new OpenFileDialog())
            {
                dialog.Filter = "Text files (*.txt)|*.txt|All files (*.*)|*.*";
                dialog.CheckFileExists = true;
                dialog.Title = "Choose terms source file to package";
                dialog.InitialDirectory = Directory.Exists(_projectFolderText.Text) ? _projectFolderText.Text : AppContext.BaseDirectory;
                if (dialog.ShowDialog(this) == DialogResult.OK)
                {
                    _termsFileText.Text = dialog.FileName;
                }
            }
        }

        private void BrowseOutputZip()
        {
            using (var dialog = new SaveFileDialog())
            {
                dialog.Filter = "Zip package (*.zip)|*.zip";
                dialog.AddExtension = true;
                dialog.DefaultExt = "zip";
                dialog.Title = "Choose output SCORM zip name";
                dialog.FileName = Path.GetFileName(_outputZipText.Text);
                dialog.InitialDirectory = Directory.Exists(_projectFolderText.Text) ? _projectFolderText.Text : AppContext.BaseDirectory;
                if (dialog.ShowDialog(this) == DialogResult.OK)
                {
                    _outputZipText.Text = dialog.FileName;
                }
            }
        }

        private void BuildPackage()
        {
            try
            {
                _statusLabel.Text = "Status: Building package...";
                UseWaitCursor = true;
                Cursor.Current = Cursors.WaitCursor;

                var options = new ScormBuildOptions
                {
                    ProjectFolder = _projectFolderText.Text.Trim(),
                    TermsSourceFile = _termsFileText.Text.Trim(),
                    OutputZipFile = _outputZipText.Text.Trim(),
                    ActivityTitle = _activityTitleText.Text.Trim(),
                    PackageIdentifier = _packageIdText.Text.Trim()
                };

                BuildScormPackage(options);
                _statusLabel.Text = "Status: Success. Created " + _outputZipText.Text;
                MessageBox.Show(
                    this,
                    "SCORM package created successfully:\r\n" + _outputZipText.Text,
                    "SCORM Build Complete",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
            }
            catch (Exception ex)
            {
                _statusLabel.Text = "Status: Build failed.";
                MessageBox.Show(
                    this,
                    ex.Message,
                    "SCORM Build Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
            finally
            {
                UseWaitCursor = false;
                Cursor.Current = Cursors.Default;
            }
        }

        private static void BuildScormPackage(ScormBuildOptions options)
        {
            ValidateOptions(options);
            var packageId = string.IsNullOrWhiteSpace(options.PackageIdentifier)
                ? BuildIdentifierFromTitle(options.ActivityTitle)
                : options.PackageIdentifier.Trim();

            var tempDir = Path.Combine(Path.GetTempPath(), "StudyArcadeScormBuilder", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempDir);
            try
            {
                CopyRequiredFile(options.ProjectFolder, tempDir, "index.html");
                CopyRequiredFile(options.ProjectFolder, tempDir, "app.js");
                CopyRequiredFile(options.ProjectFolder, tempDir, "styles.css");
                File.Copy(options.TermsSourceFile, Path.Combine(tempDir, "terms.txt"), true);

                var manifestPath = Path.Combine(tempDir, "imsmanifest.xml");
                File.WriteAllText(manifestPath, BuildManifestXml(packageId, options.ActivityTitle), Encoding.UTF8);

                var outDir = Path.GetDirectoryName(options.OutputZipFile);
                if (string.IsNullOrWhiteSpace(outDir))
                {
                    throw new InvalidOperationException("Output zip path is invalid.");
                }
                Directory.CreateDirectory(outDir);
                if (File.Exists(options.OutputZipFile))
                {
                    File.Delete(options.OutputZipFile);
                }
                ZipFile.CreateFromDirectory(tempDir, options.OutputZipFile, CompressionLevel.Optimal, false);
            }
            finally
            {
                if (Directory.Exists(tempDir))
                {
                    Directory.Delete(tempDir, true);
                }
            }
        }

        private static void ValidateOptions(ScormBuildOptions options)
        {
            if (!Directory.Exists(options.ProjectFolder))
            {
                throw new InvalidOperationException("Project folder does not exist:\r\n" + options.ProjectFolder);
            }
            if (!File.Exists(options.TermsSourceFile))
            {
                throw new InvalidOperationException("Terms source file was not found:\r\n" + options.TermsSourceFile);
            }
            if (string.IsNullOrWhiteSpace(options.OutputZipFile))
            {
                throw new InvalidOperationException("Please provide an output zip file name.");
            }
            if (string.IsNullOrWhiteSpace(options.ActivityTitle))
            {
                throw new InvalidOperationException("Please provide an Activity Title.");
            }
            foreach (var required in new[] { "index.html", "app.js", "styles.css" })
            {
                var requiredPath = Path.Combine(options.ProjectFolder, required);
                if (!File.Exists(requiredPath))
                {
                    throw new InvalidOperationException("Required file missing in project folder:\r\n" + requiredPath);
                }
            }
        }

        private static void CopyRequiredFile(string projectFolder, string destinationFolder, string fileName)
        {
            var source = Path.Combine(projectFolder, fileName);
            var target = Path.Combine(destinationFolder, fileName);
            File.Copy(source, target, true);
        }

        private static string BuildIdentifierFromTitle(string title)
        {
            var builder = new StringBuilder();
            foreach (var ch in title)
            {
                if (char.IsLetterOrDigit(ch))
                {
                    builder.Append(ch);
                }
                else if (ch == ' ' || ch == '-' || ch == '_')
                {
                    builder.Append('_');
                }
            }
            var value = builder.ToString().Trim('_');
            return string.IsNullOrWhiteSpace(value) ? "StudyArcade_SCORM12" : value + "_SCORM12";
        }

        private static string BuildManifestXml(string packageId, string activityTitle)
        {
            var safeId = SecurityElement.Escape(packageId) ?? "StudyArcade_SCORM12";
            var safeTitle = SecurityElement.Escape(activityTitle) ?? "Study Arcade";
            return
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                "<manifest identifier=\"" + safeId + "\"\n" +
                "  version=\"1.0\"\n" +
                "  xmlns=\"http://www.imsproject.org/xsd/imscp_rootv1p1p2\"\n" +
                "  xmlns:adlcp=\"http://www.adlnet.org/xsd/adlcp_rootv1p2\"\n" +
                "  xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n" +
                "  xsi:schemaLocation=\"\n" +
                "    http://www.imsproject.org/xsd/imscp_rootv1p1p2 ims_cp_rootv1p1p2.xsd\n" +
                "    http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd\">\n\n" +
                "  <metadata>\n" +
                "    <schema>ADL SCORM</schema>\n" +
                "    <schemaversion>1.2</schemaversion>\n" +
                "  </metadata>\n\n" +
                "  <organizations default=\"ORG-1\">\n" +
                "    <organization identifier=\"ORG-1\">\n" +
                "      <title>" + safeTitle + "</title>\n" +
                "      <item identifier=\"ITEM-1\" identifierref=\"RES-1\">\n" +
                "        <title>" + safeTitle + "</title>\n" +
                "      </item>\n" +
                "    </organization>\n" +
                "  </organizations>\n\n" +
                "  <resources>\n" +
                "    <resource identifier=\"RES-1\" type=\"webcontent\" adlcp:scormtype=\"sco\" href=\"index.html\">\n" +
                "      <file href=\"index.html\"/>\n" +
                "      <file href=\"app.js\"/>\n" +
                "      <file href=\"styles.css\"/>\n" +
                "      <file href=\"terms.txt\"/>\n" +
                "    </resource>\n" +
                "  </resources>\n" +
                "</manifest>\n";
        }
    }

    internal sealed class ScormBuildOptions
    {
        public string ProjectFolder = string.Empty;
        public string TermsSourceFile = string.Empty;
        public string OutputZipFile = string.Empty;
        public string ActivityTitle = string.Empty;
        public string PackageIdentifier = string.Empty;
    }
}
