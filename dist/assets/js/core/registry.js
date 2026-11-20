export const CATEGORIES = [
  { id: 'developer', name: 'Developer', blurb: 'Format, encode, decode and inspect the data you handle every day.' },
  { id: 'security', name: 'Security', blurb: 'Defensive checks for passwords, hashes, DNS mail policy and HTTP headers.' },
  { id: 'networking', name: 'Networking', blurb: 'Look up IPs, DNS records and registration data, and work out subnets.' },
  { id: 'productivity', name: 'Text & productivity', blurb: 'Count, clean and convert text, plus timers, dates and calculators.' },
  { id: 'image', name: 'Image & file', blurb: 'Resize, convert and inspect files without uploading them anywhere.' },
  { id: 'information', name: 'Public data', blurb: 'Live data from BMKG and other public APIs, with the source shown on every result.' },
  { id: 'ai', name: 'AI', blurb: 'Language model helpers that run through your own configured provider.' },
  { id: 'games', name: 'Games', blurb: 'Quick browser games for a break between tasks. They run on this device; best times stay in this browser.' },
];

const T = (id, category, name, description, signature, runs, module, exp, extra = {}) =>
  ({ id, category, name, description, signature, runs, module, export: exp, tags: [], usage: [], ...extra });

export const TOOLS = [
  // Developer
  T('json', 'developer', 'JSON formatter', 'Validate, pretty-print, minify or sort JSON. Errors point to the exact line and column.', ['text', 'json'], 'local', 'developer/json.js', 'jsonTool', {
    featured: true, tags: ['validator', 'minifier', 'beautify', 'pretty print', 'lint'],
    usage: ['Paste JSON on the left. It is validated as you type.', 'Use Format, Minify or Sort keys to transform it.', 'Invalid input shows the line and column of the first error.'],
  }),
  T('xml', 'developer', 'XML formatter', 'Pretty-print or minify XML, with well-formedness errors from the browser parser.', ['xml', 'xml'], 'local', 'developer/xml.js', 'xmlTool', {
    tags: ['beautify', 'svg', 'rss', 'validator'],
    usage: ['Paste XML and choose an indent.', 'Comments and CDATA sections are kept.'],
  }),
  T('markdown', 'developer', 'Markdown editor', 'Write Markdown with a live preview. Raw HTML is escaped and links are sanitised.', ['md', 'html'], 'local', 'developer/markdown.js', 'markdownTool', {
    tags: ['preview', 'gfm', 'readme', 'editor'],
    usage: ['Your draft is saved on this device as you type.', 'Copy the rendered HTML or download the .md file.'],
  }),
  T('regex', 'developer', 'Regex tester', 'Test JavaScript regular expressions with live match highlighting, groups and replace.', ['pattern', 'matches'], 'local', 'developer/regex.js', 'regexTool', {
    featured: true, tags: ['regexp', 'pattern', 'match', 'replace', 'capture groups'],
    usage: ['Enter a pattern without slashes and pick flags.', 'Matches highlight in the test text, groups are listed below.', 'Fill in Replace to preview String.replace output with $1, $<name> and so on.'],
  }),
  T('uuid', 'developer', 'UUID generator', 'Generate random v4 or time-ordered v7 UUIDs in bulk.', ['count', 'uuid'], 'local', 'developer/generators.js', 'uuidTool', {
    tags: ['guid', 'v4', 'v7', 'unique id'],
    usage: ['v4 is fully random. v7 starts with a millisecond timestamp, so values sort by creation time.'],
  }),
  T('timestamp', 'developer', 'Timestamp converter', 'Convert Unix seconds or milliseconds to dates and back, in UTC and your local zone.', ['epoch', 'date'], 'local', 'developer/time.js', 'timestampTool', {
    tags: ['unix', 'epoch', 'iso 8601', 'date'],
    usage: ['Paste a Unix timestamp or any date string. Seconds and milliseconds are detected by length.'],
  }),
  T('cron', 'developer', 'Cron expression helper', 'Explain a 5-field cron expression in plain words and list its next run times.', ['cron', 'schedule'], 'local', 'developer/time.js', 'cronTool', {
    tags: ['crontab', 'schedule', 'job'],
    usage: ['Fields: minute, hour, day of month, month, day of week.', 'Supports *, lists, ranges, steps and names like MON or JAN.', 'Next runs are computed in your local time zone.'],
  }),
  T('url-encode', 'developer', 'URL encoder', 'Percent-encode or decode text, and break a URL into its parts and query parameters.', ['text', 'url'], 'local', 'developer/encoding.js', 'urlTool', {
    tags: ['percent encoding', 'decode', 'query string', 'uri'],
    usage: ['Component mode encodes everything except letters, digits and - _ . ! ~ * \' ( ).', 'Paste a full URL to see the parsed parts.'],
  }),
  T('base64', 'developer', 'Base64 encoder', 'Encode or decode Base64 and Base64URL, with full UTF-8 support.', ['text', 'base64'], 'local', 'developer/encoding.js', 'base64Tool', {
    tags: ['encode', 'decode', 'base64url', 'atob', 'btoa'],
    usage: ['For files and images, use Image to Base64 in Image & file.'],
  }),
  T('jwt', 'developer', 'JWT decoder', 'Decode a JSON Web Token header and payload and read its time claims. The signature is not verified.', ['jwt', 'json'], 'local', 'developer/encoding.js', 'jwtTool', {
    featured: true, tags: ['json web token', 'bearer', 'claims', 'decode'],
    usage: ['Decoding happens in your browser. The token is never sent anywhere.', 'exp, iat and nbf are shown as dates with a status.'],
  }),
  T('hash', 'developer', 'Hash generator', 'Compute MD5, SHA-1, SHA-256, SHA-384 and SHA-512 digests of text, with optional HMAC.', ['text', 'digest'], 'local', 'developer/hash.js', 'hashTool', {
    tags: ['sha256', 'sha512', 'sha1', 'md5', 'hmac', 'checksum'],
    usage: ['Text is hashed as UTF-8.', 'Add an HMAC key to compute HMAC for the SHA algorithms.', 'To hash a file, use File hash checker in Security.'],
  }),
  T('color', 'developer', 'Color converter', 'Convert between HEX, RGB, HSL and OKLCH, and check WCAG contrast against another color.', ['color', 'color'], 'local', 'developer/color.js', 'colorTool', {
    tags: ['hex', 'rgb', 'hsl', 'oklch', 'contrast', 'wcag'],
    usage: ['Type any CSS color: #f0a43a, rgb(240 164 58), hsl(35 86% 58%) or a name like teal.'],
  }),
  T('gradient', 'developer', 'CSS gradient builder', 'Build linear, radial or conic gradients with editable stops and copy the CSS.', ['stops', 'css'], 'local', 'developer/color.js', 'gradientTool', {
    tags: ['linear-gradient', 'radial', 'conic', 'background'],
  }),
  T('html-entities', 'developer', 'HTML entity encoder', 'Escape text for safe use in HTML, or decode named and numeric entities.', ['text', 'html'], 'local', 'developer/encoding.js', 'entitiesTool', {
    tags: ['escape', 'unescape', 'entities', '&amp;'],
  }),
  T('diff', 'developer', 'Text diff', 'Compare two texts line by line and see what was added and removed.', ['a + b', 'diff'], 'local', 'developer/diff.js', 'diffTool', {
    tags: ['compare', 'difference', 'changes', 'comparator'],
    usage: ['Optionally ignore whitespace or letter case.', 'Copy the result as a unified diff.'],
  }),
  T('qr', 'developer', 'QR code generator', 'Create QR codes for text, links or Wi-Fi and download them as SVG or PNG.', ['text', 'qr'], 'local', 'developer/qr.js', 'qrTool', {
    tags: ['qrcode', 'barcode', 'wifi', 'png', 'svg', 'exporter'],
    usage: ['Higher error correction survives more damage but makes a denser code.'],
  }),
  T('lorem', 'developer', 'Lorem ipsum generator', 'Generate placeholder paragraphs, sentences or words for layouts.', ['count', 'text'], 'local', 'developer/generators.js', 'loremTool', {
    tags: ['placeholder', 'dummy text', 'filler'],
  }),

  // Security
  T('password', 'security', 'Password generator', 'Generate passwords or passphrases with the browser cryptographic random source.', ['rules', 'secret'], 'local', 'security/password.js', 'passwordGenTool', {
    featured: true, tags: ['random', 'passphrase', 'secure', 'generator'],
    usage: ['Characters are picked with crypto.getRandomValues and rejection sampling, so there is no bias.', 'Entropy is calculated from the actual pool size and length.'],
  }),
  T('password-strength', 'security', 'Password strength checker', 'Estimate how guessable a password is and why. Nothing you type leaves the page.', ['secret', 'score'], 'local', 'security/password.js', 'passwordStrengthTool', {
    tags: ['strength', 'entropy', 'audit'],
    usage: ['The estimate penalises common passwords, keyboard runs, repeats, dates and dictionary words.', 'It is an estimate. A password manager with unique generated passwords is the real fix.'],
  }),
  T('hash-identify', 'security', 'Hash identifier', 'Suggest likely algorithms for a hash string based on its length, alphabet and prefix.', ['hash', 'type'], 'local', 'security/hash-id.js', 'hashIdTool', {
    tags: ['bcrypt', 'md5', 'sha', 'argon2', 'identify'],
    usage: ['Results are candidates, not proof. Many algorithms share the same output length.'],
  }),
  T('file-hash', 'security', 'File hash checker', 'Compute SHA-256, SHA-512, SHA-1 and MD5 of a local file and compare with an expected checksum.', ['file', 'digest'], 'local', 'security/file-hash.js', 'fileHashTool', {
    tags: ['checksum', 'verify', 'download', 'integrity', 'sha256'],
    usage: ['The file is read in your browser and never uploaded.', 'Paste the published checksum to see if it matches.'],
  }),
  T('dns-security', 'security', 'DNS security lookup', 'Check a domain for SPF, DMARC, CAA, MX and DNSSEC validation.', ['domain', 'report'], 'api', 'security/dns-security.js', 'dnsSecurityTool', {
    source: { name: 'Google Public DNS', url: 'https://developers.google.com/speed/public-dns/docs/doh/json' },
    tags: ['spf', 'dmarc', 'caa', 'dnssec', 'email security', 'mx'],
    usage: ['DNSSEC shows as validated when the resolver returns the AD flag.', 'DKIM is not checked because it needs a selector name you would have to know.'],
  }),
  T('http-headers', 'security', 'HTTP security headers', 'Check from the server which security headers a URL sends: HSTS, CSP, frame and content-type options.', ['url', 'headers'], 'server', 'security/headers.js', 'headersTool', {
    tags: ['hsts', 'csp', 'x-frame-options', 'header viewer', 'analyzer'],
    usage: ['The request is made by the KrysTools server function, because browsers cannot read most cross-site headers.', 'Private and local network addresses are refused.'],
  }),

  // Networking
  T('ip-lookup', 'networking', 'IP lookup', 'See your public IP, or look up any IP for location, ASN, ISP and time zone.', ['ip', 'geo + asn'], 'api', 'networking/ip.js', 'ipLookupTool', {
    source: { name: 'ipwho.is and ipify', url: 'https://ipwho.is/' },
    tags: ['public ip', 'what is my ip', 'asn', 'geolocation', 'isp'],
    usage: ['IP geolocation is approximate and often points to the ISP, not the person.'],
  }),
  T('dns-lookup', 'networking', 'DNS lookup', 'Query A, AAAA, CNAME, MX, TXT, NS, SOA, CAA and other records over DNS-over-HTTPS.', ['domain', 'records'], 'api', 'networking/dns.js', 'dnsLookupTool', {
    featured: true, source: { name: 'Google Public DNS', url: 'https://developers.google.com/speed/public-dns/docs/doh/json' },
    tags: ['dig', 'nslookup', 'mx', 'txt', 'records', 'resolver'],
  }),
  T('reverse-dns', 'networking', 'Reverse DNS', 'Find the PTR hostname for an IPv4 or IPv6 address.', ['ip', 'hostname'], 'api', 'networking/dns.js', 'reverseDnsTool', {
    source: { name: 'Google Public DNS', url: 'https://developers.google.com/speed/public-dns/docs/doh/json' },
    tags: ['ptr', 'rdns', 'hostname'],
  }),
  T('rdap', 'networking', 'Domain and IP registration', 'Look up registrar, dates, status and name servers for a domain, or the network owner of an IP, via RDAP.', ['domain', 'registry'], 'api', 'networking/rdap.js', 'rdapTool', {
    source: { name: 'IANA RDAP bootstrap and registry RDAP servers', url: 'https://data.iana.org/rdap/' },
    tags: ['whois', 'registrar', 'expiry', 'domain info', 'rdap'],
    usage: ['RDAP is the structured successor to WHOIS.', 'Some country-code domains do not publish RDAP yet; these are reported as unsupported.'],
  }),
  T('subnet', 'networking', 'Subnet calculator', 'Work out network, broadcast, host range and mask for any IPv4 CIDR, or split it into smaller subnets.', ['cidr', 'ranges'], 'local', 'networking/subnet.js', 'subnetTool', {
    featured: true, tags: ['cidr', 'netmask', 'ipv4', 'wildcard', 'hosts'],
  }),
  T('ip-convert', 'networking', 'IP address converter', 'Convert IPv4 between dotted, integer, hex and binary, and expand or compress IPv6.', ['ip', 'formats'], 'local', 'networking/subnet.js', 'ipConvertTool', {
    tags: ['ipv4', 'ipv6', 'decimal', 'binary', 'hex'],
  }),
  T('user-agent', 'networking', 'User-Agent parser', 'Parse a User-Agent string into browser, engine, OS and device type.', ['ua', 'device'], 'local', 'networking/ua.js', 'uaTool', {
    tags: ['browser', 'device', 'os', 'useragent'],
    usage: ['Starts with your own User-Agent. Paste any other to parse it.', 'User-Agent strings can be spoofed and are frozen in some browsers, so treat results as hints.'],
  }),
  T('url-status', 'networking', 'URL status checker', 'Check if a website is up: status code, redirects and response time over several attempts.', ['url', 'status'], 'server', 'networking/url-status.js', 'urlStatusTool', {
    tags: ['uptime', 'availability', 'latency', 'redirect', 'ping', 'down'],
    usage: ['Requests run from the KrysTools server function, so timings reflect that server location.', 'Private and local network addresses are refused.'],
  }),

  // Productivity
  T('text-stats', 'productivity', 'Word counter', 'Count words, characters, sentences and paragraphs, with reading and speaking time.', ['text', 'counts'], 'local', 'productivity/text.js', 'textStatsTool', {
    featured: true, tags: ['character counter', 'reading time', 'word count'],
  }),
  T('case', 'productivity', 'Case converter', 'Convert text to camelCase, snake_case, kebab-case, Title Case and more.', ['text', 'text'], 'local', 'productivity/text.js', 'caseTool', {
    tags: ['camel', 'snake', 'kebab', 'pascal', 'uppercase', 'title case'],
  }),
  T('text-clean', 'productivity', 'Text cleaner', 'Trim whitespace, collapse spaces, strip line breaks, smart quotes and invisible characters.', ['text', 'text'], 'local', 'productivity/text.js', 'cleanTool', {
    tags: ['whitespace', 'trim', 'strip', 'zero width'],
  }),
  T('lines', 'productivity', 'Line sorter and deduplicator', 'Sort, reverse, shuffle and remove duplicate or empty lines.', ['lines', 'lines'], 'local', 'productivity/text.js', 'linesTool', {
    tags: ['sort', 'unique', 'duplicate line remover', 'dedupe'],
  }),
  T('notes', 'productivity', 'Notes', 'Quick Markdown notes saved in this browser. Nothing is synced or uploaded.', ['text', 'notes'], 'local', 'productivity/notes.js', 'notesTool', {
    tags: ['notepad', 'scratchpad', 'memo'],
    usage: ['Notes live in this browser\'s local storage. Clearing site data deletes them.', 'Export downloads all notes as a JSON file.'],
  }),
  T('pomodoro', 'productivity', 'Pomodoro timer', 'Focus and break intervals with an optional sound at the end of each.', ['time', 'focus'], 'local', 'productivity/timers.js', 'pomodoroTool', {
    tags: ['focus', 'timer', 'break'],
  }),
  T('stopwatch', 'productivity', 'Stopwatch and countdown', 'A lap stopwatch and a countdown timer.', ['time', 'time'], 'local', 'productivity/timers.js', 'stopwatchTool', {
    tags: ['timer', 'laps', 'countdown'],
  }),
  T('units', 'productivity', 'Unit converter', 'Convert length, mass, temperature, area, volume, speed, data size and time.', ['value', 'value'], 'local', 'productivity/units.js', 'unitsTool', {
    tags: ['metric', 'imperial', 'file size', 'bytes', 'temperature'],
    usage: ['Data size offers both decimal (KB = 1000 B) and binary (KiB = 1024 B) units.'],
  }),
  T('date-calc', 'productivity', 'Date calculator', 'Find the difference between two dates, or add and subtract days, weeks and months.', ['dates', 'span'], 'local', 'productivity/dates.js', 'dateCalcTool', {
    tags: ['days between', 'age', 'add days', 'business days'],
  }),
  T('timezone', 'productivity', 'Time zone converter', 'Convert a time across time zones and compare current times around the world.', ['time', 'zones'], 'local', 'productivity/dates.js', 'timezoneTool', {
    tags: ['world clock', 'utc', 'wib', 'meeting planner'],
    usage: ['Uses your browser\'s built-in IANA time zone data, including daylight saving rules.'],
  }),
  T('percent', 'productivity', 'Percentage calculator', 'Percent of a number, percentage change, and what percent one number is of another.', ['numbers', 'percent'], 'local', 'productivity/calc.js', 'percentTool', {
    tags: ['percent', 'increase', 'decrease', 'discount'],
  }),
  T('calculator', 'productivity', 'Scientific calculator', 'Evaluate expressions with functions, constants and memory. Keyboard friendly.', ['expr', 'number'], 'local', 'productivity/calc.js', 'calculatorTool', {
    tags: ['math', 'sin', 'log', 'sqrt'],
    usage: ['Type an expression like 2^10 / sqrt(16) + sin(pi/2).', 'Choose degrees or radians for trigonometry.', 'Expressions are parsed by KrysTools, never passed to eval.'],
  }),

  // Image and file
  T('image-convert', 'image', 'Image resizer and converter', 'Resize, compress and convert images to JPEG, PNG or WebP in your browser.', ['image', 'image'], 'local', 'image/image.js', 'imageConvertTool', {
    featured: true, tags: ['compress', 'resize', 'webp', 'jpeg', 'png', 'format converter'],
    usage: ['Processing happens on a canvas in your browser. Nothing is uploaded.', 'Converting strips metadata such as EXIF location.'],
  }),
  T('image-base64', 'image', 'Image to Base64', 'Turn an image into a data URI, or preview and download a Base64 image.', ['image', 'base64'], 'local', 'image/image.js', 'imageBase64Tool', {
    tags: ['data uri', 'base64 to image', 'inline image'],
  }),
  T('exif', 'image', 'Image metadata viewer', 'Read EXIF data from JPEG photos: camera, lens, exposure, date and GPS location.', ['jpeg', 'exif'], 'local', 'image/exif.js', 'exifTool', {
    tags: ['exif', 'metadata', 'gps', 'camera'],
    usage: ['Reads JPEG EXIF. Use Image resizer and converter to export a copy without metadata.'],
  }),
  T('svg', 'image', 'SVG optimizer', 'Preview SVG and shrink it by removing comments, editor metadata and whitespace.', ['svg', 'svg'], 'local', 'image/svg.js', 'svgTool', {
    tags: ['svg viewer', 'minify', 'optimize', 'vector'],
    usage: ['The preview renders the SVG as an image, so scripts inside it never run.'],
  }),
  T('file-info', 'image', 'File inspector', 'Show a file\'s size, MIME type, real type from its magic bytes, and a hex preview.', ['file', 'info'], 'local', 'image/file-info.js', 'fileInfoTool', {
    tags: ['magic bytes', 'mime', 'hex', 'file type', 'file size'],
  }),
  T('text-pdf', 'image', 'Text to PDF', 'Turn plain text into a downloadable PDF with page size and font options.', ['text', 'pdf'], 'local', 'image/text-pdf.js', 'textPdfTool', {
    tags: ['pdf', 'export', 'document'],
    usage: ['Uses the standard PDF fonts, which cover Latin characters. Other scripts are replaced with "?".'],
  }),

  // Public data
  T('earthquake', 'information', 'BMKG earthquake info', 'The latest earthquake in Indonesia, recent M5+ events, and quakes reported as felt.', ['live', 'quakes'], 'api', 'information/bmkg.js', 'quakeTool', {
    featured: true, source: { name: 'BMKG', url: 'https://data.bmkg.go.id/gempabumi/' },
    tags: ['gempa', 'bmkg', 'indonesia', 'tsunami', 'seismic'],
    usage: ['Data refreshes from BMKG every time you open the tool, with a short cache.', 'The shakemap image is published by BMKG for the latest event.'],
  }),
  T('weather', 'information', 'BMKG weather forecast', 'Three-day forecast in 3-hour steps for Indonesian locations.', ['region', 'forecast'], 'api', 'information/bmkg.js', 'weatherTool', {
    source: { name: 'BMKG', url: 'https://data.bmkg.go.id/prakiraan-cuaca/' },
    tags: ['cuaca', 'bmkg', 'forecast', 'indonesia', 'rain'],
    usage: ['Pick a city, or enter any village code (kode wilayah adm4, for example 31.71.03.1001).'],
  }),
  T('currency', 'information', 'Currency converter', 'Convert between currencies with reference rates from the European Central Bank.', ['amount', 'amount'], 'api', 'information/currency.js', 'currencyTool', {
    source: { name: 'Frankfurter (ECB reference rates)', url: 'https://frankfurter.dev/' },
    tags: ['exchange rate', 'idr', 'usd', 'forex'],
    usage: ['Rates are published once per working day around 16:00 CET. They are reference rates, not trading prices.'],
  }),
  T('holidays', 'information', 'Public holidays', 'Find public holidays by year for countries supported by Nager.Date.', ['country', 'dates'], 'api', 'information/holidays.js', 'holidaysTool', {
    source: { name: 'Nager.Date', url: 'https://date.nager.at/' },
    tags: ['holiday', 'calendar', 'libur', 'day off'],
  }),
  T('postal', 'information', 'Postal code lookup', 'Find places behind a postal code in countries supported by Zippopotam.us.', ['zip', 'places'], 'api', 'information/postal.js', 'postalTool', {
    source: { name: 'Zippopotam.us', url: 'https://www.zippopotam.us/' },
    tags: ['zip code', 'postcode', 'kode pos'],
  }),
  T('sun', 'information', 'Sunrise, sunset and moon', 'Sunrise, sunset, twilight and day length for any location, plus an approximate moon phase for the selected date.', ['location', 'times'], 'api', 'information/sun.js', 'sunTool', {
    source: { name: 'Sunrise-Sunset.org', url: 'https://sunrise-sunset.org/api' },
    tags: ['astronomy', 'moon phase', 'golden hour', 'twilight'],
    usage: ['Moon phase is calculated locally from the date.'],
  }),
  T('dictionary', 'information', 'English dictionary', 'Definitions, phonetics, examples and synonyms for English words.', ['word', 'meaning'], 'api', 'information/dictionary.js', 'dictionaryTool', {
    source: { name: 'Free Dictionary API', url: 'https://dictionaryapi.dev/' },
    tags: ['define', 'meaning', 'synonym', 'pronunciation'],
  }),
  T('translate', 'information', 'Translator', 'Translate short texts between common languages using the MyMemory translation memory.', ['text', 'text'], 'api', 'information/dictionary.js', 'translateTool', {
    source: { name: 'MyMemory', url: 'https://mymemory.translated.net/doc/spec.php' },
    tags: ['translation', 'terjemahan', 'language'],
    usage: ['Free usage is limited to 500 UTF-8 bytes per request and a daily quota per IP.', 'For tone-aware translation, use AI translator.'],
  }),
  T('fact', 'information', 'Random fact', 'A random fact, one click at a time.', ['click', 'fact'], 'api', 'information/random.js', 'factTool', {
    source: { name: 'Useless Facts API', url: 'https://uselessfacts.jsph.pl/' },
    tags: ['trivia', 'fun'],
  }),
  T('quote', 'information', 'Random quote', 'A random quote with its author.', ['click', 'quote'], 'api', 'information/random.js', 'quoteTool', {
    source: { name: 'DummyJSON', url: 'https://dummyjson.com/docs/quotes' },
    tags: ['quotes', 'inspiration'],
  }),

  // AI
  ...[
    ['ai-summarize', 'AI summarizer', 'Condense long text into a short summary or key points.', ['text', 'summary'], ['summary', 'tldr']],
    ['ai-rewrite', 'AI rewriter', 'Rewrite text in a different tone or length while keeping the meaning.', ['text', 'text'], ['paraphrase', 'tone']],
    ['ai-translate', 'AI translator', 'Context-aware translation that keeps formatting and tone.', ['text', 'text'], ['translation', 'localize']],
    ['ai-grammar', 'AI grammar checker', 'Fix grammar, spelling and punctuation and list what changed.', ['text', 'text'], ['proofread', 'spelling']],
    ['ai-explain', 'AI code explainer', 'Explain what a piece of code does, step by step.', ['code', 'prose'], ['explain', 'review']],
    ['ai-code', 'AI code generator', 'Describe a function or snippet and get code in the language you choose.', ['prompt', 'code'], ['generate', 'snippet']],
    ['ai-regex', 'AI regex generator', 'Describe what to match and get a regular expression with an explanation.', ['prompt', 'pattern'], ['regexp', 'pattern']],
    ['ai-json', 'AI JSON assistant', 'Repair broken JSON, convert data to JSON, or draft a JSON Schema.', ['text', 'json'], ['repair', 'schema']],
    ['ai-prompt', 'AI prompt generator', 'Turn a rough goal into a clear, structured prompt for a language model.', ['goal', 'prompt'], ['prompt engineering']],
    ['ai-docs', 'AI documentation writer', 'Write docstrings, README sections or API docs from code.', ['code', 'docs'], ['docstring', 'readme', 'jsdoc']],
  ].map(([id, name, description, signature, tags]) =>
    T(id, 'ai', name, description, signature, 'server', 'ai/ai-tools.js', 'aiTool', {
      tags: ['ai', 'llm', ...tags],
      usage: ['Requests go to the KrysTools AI server function, which calls the provider configured by the site owner. API keys stay on the server.', 'Do not paste secrets or personal data. Output can be wrong, so review it before use.'],
    })),

  // Games
  T('dino-runner', 'games', 'Dino Runner 3D', 'Endless 3D runner across a sunset desert. Jump the obstacles and beat your high score.', ['play', 'score'], 'local', 'games/games.js', 'gameTool', {
    tags: ['game', 'runner', 'dino', '3d', 'icebreaker'],
    usage: ['Click inside the game first so it receives your keys.', 'Space, Up or W to jump; Down or S to duck. On a phone, tap. Your high score is saved in this browser.', 'Uses WebGL; older devices may run it slowly.'],
  }),
  T('track-racer', 'games', 'Track Racer 3D', '3D chase-cam race around a circuit: 3 laps, lap timer, best lap, minimap and barriers that bounce you back.', ['play', 'lap time'], 'local', 'games/games.js', 'gameTool', {
    featured: true, tags: ['game', 'racing', 'car', 'lap', 'icebreaker'],
    usage: ['Arrow keys or WASD to drive. P pauses, R restarts.', 'On a phone, use the on-screen steering and pedal buttons.', 'A lap only counts after passing every checkpoint. Your best lap is saved in this browser.'],
  }),
];

export const toolById = new Map(TOOLS.map((t) => [t.id, t]));
export const categoryById = new Map(CATEGORIES.map((c) => [c.id, c]));
export const toolsIn = (categoryId) => TOOLS.filter((t) => t.category === categoryId);

export const RUNS_LABEL = {
  local: 'Runs locally',
  api: 'Public API',
  server: 'Server function',
};
