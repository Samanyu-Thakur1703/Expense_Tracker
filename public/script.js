
// ==================== API CLIENT ====================
const API = {
    BASE_URL: window.location.origin === 'file://' ? 'http://localhost:3001' : window.location.origin,

    getToken: function() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    },

    setToken: function(token) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, token);
    },

    clearToken: function() {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    },

    request: function(method, path, body) {
        var self = this;
        var url = this.BASE_URL + path;
        var headers = { 'Content-Type': 'application/json' };
        var token = this.getToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;

        var options = { method: method, headers: headers };
        if (body) options.body = JSON.stringify(body);

        return fetch(url, options).then(function(res) {
            return res.json().then(function(data) {
                if (!res.ok) {
                    if (res.status === 401) {
                        self.clearToken();
                        AppState.sessionActive = false;
                        AppState.user = null;
                        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
                        localStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION);
                        App.showAuth();
                    }
                    return Promise.reject(new Error(data.error || 'Request failed'));
                }
                return data;
            });
        });
    },

    // Auth
    login: function(email, password) {
        return this.request('POST', '/api/auth/login', { email: email, password: password });
    },

    signup: function(name, email, password) {
        return this.request('POST', '/api/auth/signup', { name: name, email: email, password: password });
    },

    sendOtp: function(email) {
        return this.request('POST', '/api/auth/send-otp', { email: email });
    },

    verifyOtp: function(email, code) {
        return this.request('POST', '/api/auth/verify-otp', { email: email, code: code });
    },

    getMe: function() {
        return this.request('GET', '/api/auth/me');
    },

    updateSettings: function(data) {
        return this.request('PUT', '/api/auth/settings', data);
    },

    // Expenses
    getExpenses: function(params) {
        var qs = Object.keys(params || {}).map(function(k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
        }).join('&');
        return this.request('GET', '/api/expenses' + (qs ? '?' + qs : ''));
    },

    createExpense: function(data) {
        return this.request('POST', '/api/expenses', data);
    },

    updateExpense: function(id, data) {
        return this.request('PUT', '/api/expenses/' + id, data);
    },

    deleteExpense: function(id) {
        return this.request('DELETE', '/api/expenses/' + id);
    },

    getExpenseStats: function() {
        return this.request('GET', '/api/expenses/stats');
    }
};

// ==================== CONFIGURATION ====================
const CONFIG = {
    APP_NAME: 'FinTrack AI',
    STORAGE_KEYS: {
        USER: 'fintrack_user',
        SESSION: 'fintrack_session',
        TOKEN: 'fintrack_token',
        BALANCE: 'fintrack_balance',
        BUDGET: 'fintrack_budget',
        EXPENSES: 'fintrack_expenses',
        THEME: 'fintrack_theme',
        API_CONFIG: 'fintrack_api_config',
        SETUP_COMPLETE: 'fintrack_setup_complete',
        SIDEBAR_COLLAPSED: 'fintrack_sidebar_collapsed',
        FILTER_STATE: 'fintrack_filter_state',
        EXPENSE_OFFSET: 'fintrack_expense_offset'
    },
    API: {
        ALPHA_VANTAGE_BASE: 'https://www.alphavantage.co/query',
        IEX_BASE: 'https://cloud.iexapis.com/stable',
        POLYGON_BASE: 'https://api.polygon.io/v2'
    },
    DEBOUNCE_DELAY: 300,
    STOCK_UPDATE_INTERVAL: 60000,
    CATEGORIES: ['Food', 'Travel', 'Bills', 'Shopping', 'Health', 'Investment', 'Entertainment', 'Others'],
    PAGE_SIZE: 20,
    CATEGORY_COLORS: {
        Food: '#F59E0B',
        Travel: '#3B82F6',
        Bills: '#EF4444',
        Shopping: '#8B5CF6',
        Health: '#10B981',
        Investment: '#6366F1',
        Entertainment: '#EC4899',
        Others: '#6B7280'
    }
};

// ==================== LOADING STATE ====================
const LoadingState = {
    show: function(containerId) {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.dataset.loading = 'true';
    },
    hide: function(containerId) {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.dataset.loading = 'false';
    },
    showCards: function() {
        document.querySelectorAll('.summary-card').forEach(function(c) { c.dataset.loading = 'true'; });
    },
    hideCards: function() {
        document.querySelectorAll('.summary-card').forEach(function(c) { c.dataset.loading = 'false'; });
    },
    showTable: function() {
        var tb = document.getElementById('expenses-tbody');
        if (!tb) return;
        tb.dataset.loading = 'true';
    },
    hideTable: function() {
        var tb = document.getElementById('expenses-tbody');
        if (!tb) return;
        tb.dataset.loading = 'false';
    }
};

// ==================== UTILITIES MODULE ====================
const Utils = {
    debounce: function(func, wait) {
        let timeout;
        return function() {
            var args = arguments;
            var self = this;
            clearTimeout(timeout);
            timeout = setTimeout(function() {
                func.apply(self, args);
            }, wait);
        };
    },

    escapeHTML: function(str) {
        if (typeof str !== 'string') return str;
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    formatCurrency: function(amount) {
        const num = parseFloat(amount);
        if (isNaN(num)) return '₹0.00';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2
        }).format(num);
    },

    formatDate: function(dateStr) {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    },

    isValidEmail: function(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    showError: function(elementId, message) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = message;
            el.style.display = 'block';
        }
    },

    clearError: function(elementId) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = '';
            el.style.display = 'none';
        }
    },

    clearAllErrors: function(formId) {
        const form = document.getElementById(formId);
        if (form) {
            form.querySelectorAll('.validation-error').forEach(function(el) {
                el.textContent = '';
                el.style.display = 'none';
            });
        }
    },

    generateId: function() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
};

// ==================== STATE MANAGEMENT ====================
const AppState = {
    user: JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER)) || null,
    sessionActive: localStorage.getItem(CONFIG.STORAGE_KEYS.SESSION) === 'true',
    balance: parseFloat(localStorage.getItem(CONFIG.STORAGE_KEYS.BALANCE)) || 0,
    budget: parseFloat(localStorage.getItem(CONFIG.STORAGE_KEYS.BUDGET)) || 0,
    expenses: JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.EXPENSES)) || [],
    currentView: 'dashboard',
    theme: localStorage.getItem(CONFIG.STORAGE_KEYS.THEME) || 'light',
    apiConfig: JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.API_CONFIG)) || { provider: 'alpha_vantage', key: '' },
    charts: {},
    stockUpdateInterval: null,
    _monthlyTotal: 0,
    _allTimeTotal: 0,
    _hasMore: false,
    expenseOffset: parseInt(sessionStorage.getItem(CONFIG.STORAGE_KEYS.EXPENSE_OFFSET)) || 0
};

// ==================== AUTH MODULE ====================
const Auth = {
    init: function() {
        this.setupListeners();
        if (this.isAuthenticated()) {
            App.showApp();
        } else {
            App.showAuth();
        }
    },

    isAuthenticated: function() {
        return AppState.sessionActive && AppState.user !== null;
    },

    _otpTimer: null,
    _otpEmail: '',

    setupListeners: function() {
        const toggleSignup = document.getElementById('toggle-signup');
        const toggleLogin = document.getElementById('toggle-login');
        const toggleOtp = document.getElementById('toggle-otp');
        const toggleOtpBack = document.getElementById('toggle-otp-back');
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const sendOtpBtn = document.getElementById('send-otp-btn');
        const verifyOtpBtn = document.getElementById('verify-otp-btn');
        const otpResend = document.getElementById('otp-resend');
        const otpCode = document.getElementById('otp-code');

        if (toggleSignup) {
            toggleSignup.addEventListener('click', function(e) {
                e.preventDefault();
                Auth.showSignupForm();
            });
        }

        if (toggleLogin) {
            toggleLogin.addEventListener('click', function(e) {
                e.preventDefault();
                Auth.showLoginForm();
            });
        }

        if (toggleOtp) {
            toggleOtp.addEventListener('click', function(e) {
                e.preventDefault();
                Auth.showOtpForm();
            });
        }

        if (toggleOtpBack) {
            toggleOtpBack.addEventListener('click', function(e) {
                e.preventDefault();
                Auth.showLoginForm();
            });
        }

        if (loginForm) {
            loginForm.addEventListener('submit', function(e) { Auth.handleLogin(e); });
        }

        if (signupForm) {
            signupForm.addEventListener('submit', function(e) { Auth.handleSignup(e); });
        }

        if (sendOtpBtn) {
            sendOtpBtn.addEventListener('click', function() { Auth.handleSendOtp(); });
        }

        if (verifyOtpBtn) {
            verifyOtpBtn.addEventListener('click', function() { Auth.handleVerifyOtp(); });
        }

        if (otpCode) {
            otpCode.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') Auth.handleVerifyOtp();
            });
        }

        if (otpResend) {
            otpResend.addEventListener('click', function(e) {
                e.preventDefault();
                Auth.handleSendOtp();
            });
        }
    },

    showOtpForm: function() {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('signup-form').classList.add('hidden');
        document.getElementById('otp-form').classList.remove('hidden');
        document.getElementById('auth-title').textContent = 'Email Login';
        document.getElementById('auth-subtitle').textContent = 'Verify your identity via email';
        // Reset
        document.getElementById('otp-email-step').classList.remove('hidden');
        document.getElementById('otp-verify-step').classList.add('hidden');
        document.getElementById('otp-code').value = '';
        Utils.clearAllErrors('otp-form');
    },

    showLoginForm: function() {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('signup-form').classList.add('hidden');
        document.getElementById('otp-form').classList.add('hidden');
        document.getElementById('auth-title').textContent = 'Welcome Back';
        document.getElementById('auth-subtitle').textContent = 'Log in to manage your finances';
        Utils.clearAllErrors('login-form');
    },

    showSignupForm: function() {
        document.getElementById('signup-form').classList.remove('hidden');
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('otp-form').classList.add('hidden');
        document.getElementById('auth-title').textContent = 'Create Account';
        document.getElementById('auth-subtitle').textContent = 'Join the future of finance today';
        Utils.clearAllErrors('signup-form');
    },

    handleLogin: function(e) {
        e.preventDefault();
        Utils.clearAllErrors('login-form');

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        let isValid = true;

        if (!Utils.isValidEmail(email)) {
            Utils.showError('login-email-error', 'Please enter a valid email address');
            isValid = false;
        }

        if (password.length < 4) {
            Utils.showError('login-password-error', 'Password must be at least 4 characters');
            isValid = false;
        }

        if (!isValid) return;

        API.login(email, password).then(function(data) {
            AppState.user = data.user;
            AppState.sessionActive = true;
            AppState.balance = data.user.balance || 0;
            AppState.budget = data.user.budget || 0;
            API.setToken(data.token);
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(data.user));
            localStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, 'true');
            Toast.show('Welcome back, ' + data.user.name, 'success');
            App.showApp();
        }).catch(function(err) {
            Utils.showError('login-password-error', err.message);
        });
    },

    handleSignup: function(e) {
        e.preventDefault();
        Utils.clearAllErrors('signup-form');

        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;

        let isValid = true;

        if (name.length < 2) {
            Utils.showError('signup-name-error', 'Name must be at least 2 characters');
            isValid = false;
        }

        if (!Utils.isValidEmail(email)) {
            Utils.showError('signup-email-error', 'Please enter a valid email address');
            isValid = false;
        }

        if (password.length < 8) {
            Utils.showError('signup-password-error', 'Password must be at least 8 characters');
            isValid = false;
        }

        if (!isValid) return;

        API.signup(name, email, password).then(function(data) {
            AppState.user = data.user;
            AppState.sessionActive = true;
            AppState.balance = data.user.balance || 0;
            AppState.budget = data.user.budget || 0;
            API.setToken(data.token);
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(data.user));
            localStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, 'true');
            Toast.show('Account created! Welcome, ' + name, 'success');
            App.showApp();
        }).catch(function(err) {
            Utils.showError('signup-email-error', err.message);
        });
    },

    handleSendOtp: function() {
        Utils.clearAllErrors('otp-form');
        var email = document.getElementById('otp-email').value.trim();
        if (!Utils.isValidEmail(email)) {
            Utils.showError('otp-email-error', 'Please enter a valid email address');
            return;
        }
        var btn = document.getElementById('send-otp-btn');
        btn.disabled = true;
        btn.textContent = 'Sending...';
        API.sendOtp(email).then(function() {
            Auth._otpEmail = email;
            document.getElementById('otp-email-step').classList.add('hidden');
            document.getElementById('otp-verify-step').classList.remove('hidden');
            document.getElementById('otp-email-display').textContent = email;
            btn.disabled = false;
            btn.textContent = 'Send Verification Code';
            Auth._startOtpTimer();
        }).catch(function(err) {
            btn.disabled = false;
            btn.textContent = 'Send Verification Code';
            Utils.showError('otp-email-error', err.message);
        });
    },

    handleVerifyOtp: function() {
        Utils.clearAllErrors('otp-form');
        var code = document.getElementById('otp-code').value.trim();
        if (code.length !== 6 || isNaN(code)) {
            Utils.showError('otp-code-error', 'Please enter a valid 6-digit code');
            return;
        }
        var email = Auth._otpEmail;
        var btn = document.getElementById('verify-otp-btn');
        btn.disabled = true;
        btn.textContent = 'Verifying...';
        API.verifyOtp(email, code).then(function(data) {
            if (Auth._otpTimer) clearInterval(Auth._otpTimer);
            AppState.user = data.user;
            AppState.sessionActive = true;
            AppState.balance = data.user.balance || 0;
            AppState.budget = data.user.budget || 0;
            API.setToken(data.token);
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(data.user));
            localStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, 'true');
            Toast.show(data.is_new ? 'Account created! Welcome, ' + data.user.name : 'Welcome back, ' + data.user.name, 'success');
            App.showApp();
        }).catch(function(err) {
            btn.disabled = false;
            btn.textContent = 'Verify';
            Utils.showError('otp-code-error', err.message);
        });
    },

    _startOtpTimer: function() {
        if (Auth._otpTimer) clearInterval(Auth._otpTimer);
        var seconds = 600;
        var display = document.getElementById('otp-countdown');
        Auth._otpTimer = setInterval(function() {
            seconds--;
            var m = Math.floor(seconds / 60);
            var s = seconds % 60;
            if (display) display.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
            if (seconds <= 0) {
                clearInterval(Auth._otpTimer);
                Auth._otpTimer = null;
                if (display) display.textContent = 'Expired';
            }
        }, 1000);
    },

    logout: function() {
        AppState.user = null;
        AppState.sessionActive = false;
        API.clearToken();
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION);
        App.showAuth();
        Toast.show('Signed out successfully.', 'info');
    }
};

// =================== TOAST NOTIFICATIONS ====================
const Toast = {
    show: function(message, type) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast ' + (type || 'info');

        let icon = 'info';
        if (type === 'success') icon = 'check-circle';
        else if (type === 'error') icon = 'alert-circle';
        else if (type === 'warning') icon = 'alert-triangle';

        toast.innerHTML = '<i data-lucide=\"' + icon + '\"></i><span>' + Utils.escapeHTML(message) + '</span>';
        container.appendChild(toast);

        if (window.lucide) lucide.createIcons();

        setTimeout(function() {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            setTimeout(function() { toast.remove(); }, 400);
        }, 4000);
    }
};

// =================== APP MODULE ====================
const App = {
    init: function() {
        this.applyTheme();
        Auth.init();
    },

    applyTheme: function() {
        document.documentElement.setAttribute('data-theme', AppState.theme);
        document.body.className = AppState.theme === 'dark' ? 'dark-mode' : 'light-mode';
    },

    toggleTheme: function() {
        AppState.theme = AppState.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, AppState.theme);
        this.applyTheme();
        if (AppState.currentView === 'dashboard') {
            ChartModule.renderSpendingTrend();
        }
    },

    showAuth: function() {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('app-shell').classList.add('hidden');
        document.body.style.overflow = 'hidden';

        // Hide chatbot FAB on auth screen
        const fab = document.getElementById('open-chatbot');
        if (fab) fab.classList.add('hidden');
    },

    showApp: function() {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');
        document.body.style.overflow = 'auto';

        // Show chatbot FAB when app is loaded
        const fab = document.getElementById('open-chatbot');
        if (fab) fab.classList.remove('hidden');

        if (AppState.user) {
            document.getElementById('profile-name').textContent = AppState.user.name;
            let emailText = AppState.user.email;
            if (emailText.length > 20) {
                emailText = emailText.substring(0, 18) + '...';
            }
            document.getElementById('profile-email').textContent = emailText;
            document.getElementById('avatar-img').src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(AppState.user.name);
        }

        if (!localStorage.getItem(CONFIG.STORAGE_KEYS.SETUP_COMPLETE)) {
            Modal.open('setup-modal');
        }

        this.setupAppEventListeners();
        this.refreshData();
        InvestmentModule.startStockUpdates();
    },

    refreshData: function() {
        var self = this;
        LoadingState.showCards();
        LoadingState.showTable();

        var limit = CONFIG.PAGE_SIZE;
        var offset = AppState.expenseOffset || 0;
        var params = { limit: limit, offset: offset };
        // Restore filters from session
        var savedFilter = sessionStorage.getItem(CONFIG.STORAGE_KEYS.FILTER_STATE);
        if (savedFilter) {
            try {
                var f = JSON.parse(savedFilter);
                if (f.category && f.category !== 'all') params.category = f.category;
                if (f.search) params.search = f.search;
            } catch(e) {}
        }
        var expensesPromise = API.getExpenses(params);
        var statsPromise = API.getExpenseStats();

        Promise.all([expensesPromise, statsPromise]).then(function(results) {
            var expensesData = results[0];
            var statsData = results[1];

            AppState.expenses = expensesData.expenses.map(function(e) {
                e.desc = e.description;
                return e;
            });
            AppState._hasMore = expensesData.expenses.length >= limit;

            if (statsData.monthly_total !== undefined) {
                AppState._monthlyTotal = statsData.monthly_total;
                AppState._allTimeTotal = statsData.all_time_total;
            }

            LoadingState.hideCards();
            LoadingState.hideTable();
            self.renderAll();
            if (AppState.currentView === 'expenses') {
                ExpenseModule.renderTable();
                ExpenseModule.renderLoadMore();
            }
        }).catch(function(err) {
            console.warn('Failed to refresh data from API, using local cache:', err.message);
            LoadingState.hideCards();
            LoadingState.hideTable();
            self.renderAll();
            if (AppState.currentView === 'expenses') {
                ExpenseModule.renderTable();
            }
        });
    },

    loadMoreExpenses: function() {
        var self = this;
        var offset = (AppState.expenseOffset || 0) + CONFIG.PAGE_SIZE;
        AppState.expenseOffset = offset;
        sessionStorage.setItem(CONFIG.STORAGE_KEYS.EXPENSE_OFFSET, offset);

        LoadingState.showTable();
        API.getExpenses({ limit: CONFIG.PAGE_SIZE, offset: offset }).then(function(data) {
            var newExpenses = data.expenses.map(function(e) {
                e.desc = e.description;
                return e;
            });
            AppState.expenses = AppState.expenses.concat(newExpenses);
            AppState._hasMore = newExpenses.length >= CONFIG.PAGE_SIZE;
            LoadingState.hideTable();
            ExpenseModule.renderTable();
            ExpenseModule.renderLoadMore();
        }).catch(function(err) {
            LoadingState.hideTable();
            Toast.show('Failed to load more expenses: ' + err.message, 'error');
        });
    },

    setupAppEventListeners: function() {
        const self = this;
        document.querySelectorAll('.nav-item').forEach(function(item) {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                self.switchView(item.getAttribute('data-view'));
            });
        });

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() { Auth.logout(); });
        }

        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', function() { self.toggleTheme(); });
        }

        // Event delegation: notification bell — catches clicks on Lucide SVGs inside the button
        document.body.addEventListener('click', function(e) {
            if (e.target.closest && e.target.closest('#notifications-btn')) {
                self.handleNotifications();
            }
        });

        const addExpenseQuick = document.getElementById('add-expense-quick');
        if (addExpenseQuick) {
            addExpenseQuick.addEventListener('click', function() { ExpenseModule.openAddModal(); });
        }

        const addExpenseMain = document.getElementById('add-expense-main');
        if (addExpenseMain) {
            addExpenseMain.addEventListener('click', function() { ExpenseModule.openAddModal(); });
        }

        const expenseForm = document.getElementById('expense-form');
        if (expenseForm) {
            expenseForm.addEventListener('submit', function(e) { ExpenseModule.handleSubmit(e); });
        }

        // Filter persistence
        var filterCat = document.getElementById('filter-category');
        var expenseSearch = document.getElementById('expense-search');
        if (filterCat) {
            filterCat.addEventListener('change', function() { ExpenseModule.saveFilterState(); ExpenseModule.renderTable(); });
        }
        if (expenseSearch) {
            expenseSearch.addEventListener('input', Utils.debounce(function() {
                ExpenseModule.saveFilterState();
                ExpenseModule.renderTable();
            }, CONFIG.DEBOUNCE_DELAY));
        }

        const setupForm = document.getElementById('setup-form');
        if (setupForm) {
            setupForm.addEventListener('submit', function(e) { self.handleSetup(e); });
        }

        const exportCsv = document.getElementById('export-csv');
        if (exportCsv) {
            exportCsv.addEventListener('click', function() { ExpenseModule.exportCSV(); });
        }

        const filterCategory = document.getElementById('filter-category');
        if (filterCategory) {
            filterCategory.addEventListener('change', function() { ExpenseModule.renderTable(); });
        }

        const expenseSearch = document.getElementById('expense-search');
        if (expenseSearch) {
            expenseSearch.addEventListener('input', Utils.debounce(function() { ExpenseModule.renderTable(); }, CONFIG.DEBOUNCE_DELAY));
        }

        const globalSearch = document.getElementById('global-search');
        if (globalSearch) {
            globalSearch.addEventListener('input', Utils.debounce(function(e) { self.handleGlobalSearch(e); }, CONFIG.DEBOUNCE_DELAY));
        }

        const viewAllInsightsBtn = document.getElementById('view-all-insights-btn');
        if (viewAllInsightsBtn) {
            viewAllInsightsBtn.addEventListener('click', function() { self.switchView('insights'); });
        }

        const apiConfigBtn = document.getElementById('api-config-btn');
        if (apiConfigBtn) {
            apiConfigBtn.addEventListener('click', function() { Modal.open('api-config-modal'); });
        }

        const apiConfigForm = document.getElementById('api-config-form');
        if (apiConfigForm) {
            apiConfigForm.addEventListener('submit', function(e) { InvestmentModule.handleAPIConfig(e); });
        }

        document.querySelectorAll('.close-modal').forEach(function(btn) {
            btn.addEventListener('click', function() { Modal.closeAll(); });
        });

        // Sidebar collapse toggle (fully closes sidebar to 0 width)
        const sidebarCollapseBtn = document.getElementById('sidebar-collapse-btn');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        const sidebarHamburger = document.getElementById('sidebar-hamburger');
        const sidebarToggleFloat = document.getElementById('sidebar-toggle-float');
        const mainContent = document.querySelector('.main-content');

        function updateSidebarIcons() {
            if (!sidebar) return;
            const isCollapsed = sidebar.classList.contains('collapsed');
            const isMobile = window.innerWidth <= 768;

            // Update collapse button icon
            if (sidebarCollapseBtn) {
                const icon = sidebarCollapseBtn.querySelector('i');
                if (icon) {
                    icon.setAttribute('data-lucide', isCollapsed ? 'panel-left-open' : 'panel-left-close');
                }
            }
            // Update floating toggle icon
            if (sidebarToggleFloat) {
                const icon = sidebarToggleFloat.querySelector('i');
                if (icon) {
                    icon.setAttribute('data-lucide', isCollapsed ? 'panel-left-close' : 'panel-left-open');
                }
            }
            if (window.lucide) lucide.createIcons();
        }

        function closeSidebar() {
            if (!sidebar) return;
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
                sidebarOverlay.classList.remove('active');
            } else {
                sidebar.classList.add('collapsed');
                localStorage.setItem(CONFIG.STORAGE_KEYS.SIDEBAR_COLLAPSED, 'true');
            }
            updateSidebarIcons();
        }

        function openSidebar() {
            if (!sidebar) return;
            if (window.innerWidth <= 768) {
                sidebar.classList.add('open');
                sidebarOverlay.classList.add('active');
            } else {
                sidebar.classList.remove('collapsed');
                localStorage.setItem(CONFIG.STORAGE_KEYS.SIDEBAR_COLLAPSED, 'false');
            }
            updateSidebarIcons();
        }

        function toggleSidebar() {
            if (!sidebar) return;
            if (window.innerWidth <= 768) {
                const isOpen = sidebar.classList.contains('open');
                if (isOpen) {
                    closeSidebar();
                } else {
                    openSidebar();
                }
            } else {
                sidebar.classList.toggle('collapsed');
                const isCollapsed = sidebar.classList.contains('collapsed');
                localStorage.setItem(CONFIG.STORAGE_KEYS.SIDEBAR_COLLAPSED, isCollapsed ? 'true' : 'false');
                updateSidebarIcons();
            }
        }

        // Collapse button inside sidebar header
        if (sidebarCollapseBtn) {
            sidebarCollapseBtn.addEventListener('click', toggleSidebar);
        }

        // Floating toggle button (visible when sidebar is collapsed on desktop)
        if (sidebarToggleFloat) {
            sidebarToggleFloat.addEventListener('click', toggleSidebar);
        }

        // Hamburger button (visible on mobile)
        if (sidebarHamburger) {
            sidebarHamburger.addEventListener('click', toggleSidebar);
        }

        // Overlay click closes sidebar on mobile
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', closeSidebar);
        }

        // Restore sidebar state from localStorage
        if (sidebar) {
            const isCollapsed = localStorage.getItem(CONFIG.STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
            if (isCollapsed && window.innerWidth > 768) {
                sidebar.classList.add('collapsed');
            }
            updateSidebarIcons();
        }

        // Click on main content to auto-close sidebar on medium screens
        if (mainContent && sidebar) {
            mainContent.addEventListener('click', function(e) {
                if (e.target.closest('.btn') || e.target.closest('a') || e.target.closest('input') || e.target.closest('select') || e.target.closest('textarea')) {
                    return;
                }
                // On mobile: clicking main content closes sidebar
                if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
                    closeSidebar();
                }
                // On medium screens (768-1024): auto-collapse desktop sidebar
                if (window.innerWidth > 768 && window.innerWidth < 1024 && !sidebar.classList.contains('collapsed')) {
                    sidebar.classList.add('collapsed');
                    localStorage.setItem(CONFIG.STORAGE_KEYS.SIDEBAR_COLLAPSED, 'true');
                    updateSidebarIcons();
                }
            });
        }

        // Handle window resize: switch between mobile and desktop modes
        window.addEventListener('resize', function() {
            if (!sidebar) return;
            if (window.innerWidth > 768) {
                // Switching to desktop: hide mobile overlay, close mobile open state
                sidebarOverlay.classList.remove('active');
                sidebar.classList.remove('open');
                // Restore desktop collapse state
                const isCollapsed = localStorage.getItem(CONFIG.STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
                if (isCollapsed) {
                    sidebar.classList.add('collapsed');
                } else {
                    sidebar.classList.remove('collapsed');
                }
                updateSidebarIcons();
            } else {
                // Switching to mobile: collapse is irrelevant, use open/close
                sidebar.classList.remove('open');
                sidebar.classList.remove('collapsed');
                sidebarOverlay.classList.remove('active');
                updateSidebarIcons();
            }
        });

        document.addEventListener('click', function(e) {
            const searchContainer = document.querySelector('.search-container');
            if (searchContainer && !searchContainer.contains(e.target)) {
                const results = document.getElementById('global-search-results');
                if (results) results.classList.add('hidden');
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Ctrl+/ or Cmd+/ to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                const searchInput = document.getElementById('global-search');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }

            // Escape to close chatbot
            if (e.key === 'Escape') {
                const chatbox = document.getElementById('ai-chatbot');
                const searchResults = document.getElementById('global-search-results');
                
                if (chatbox && !chatbox.classList.contains('hidden')) {
                    AIChatbot.close();
                }
                
                if (searchResults && !searchResults.classList.contains('hidden')) {
                    searchResults.classList.add('hidden');
                }
            }
        });
    }
};

// ==================== EXPENSE MODULE ====================
const ExpenseModule = {
    calculateStats: function() {
        const now = new Date();
        const monthly = AppState.expenses.filter(function(e) {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        // Calculate top category by amount
        const categoryTotals = {};
        AppState.expenses.forEach(function(e) {
            categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
        });

        let topCategory = null;
        let topAmount = 0;
        Object.keys(categoryTotals).forEach(function(cat) {
            if (categoryTotals[cat] > topAmount) {
                topAmount = categoryTotals[cat];
                topCategory = cat;
            }
        });

        return {
            totalMonthly: monthly.reduce(function(s, e) { return s + e.amount; },0),
            totalAllTime: AppState.expenses.reduce(function(s, e) { return s + e.amount; },0),
            topCategory: topCategory,
            topCategoryAmount: topAmount
        };
    },

    openAddModal: function() {
        document.getElementById('modal-title').textContent = 'Add New Expense';
        document.getElementById('expense-form').reset();
        document.getElementById('edit-expense-id').value = '';
        document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
        Utils.clearAllErrors('expense-form');
        Modal.open('expense-modal');
    },

    openEditModal: function(id) {
        const expense = AppState.expenses.find(function(e) { return e.id == id; });
        if (!expense) return;

        document.getElementById('modal-title').textContent = 'Edit Expense';
        document.getElementById('edit-expense-id').value = expense.id;
        document.getElementById('exp-amount').value = expense.amount;
        document.getElementById('exp-category').value = expense.category;
        document.getElementById('exp-desc').value = expense.description || expense.desc || '';
        document.getElementById('exp-date').value = expense.date;
        Utils.clearAllErrors('expense-form');
        Modal.open('expense-modal');
    },

    handleSubmit: function(e) {
        e.preventDefault();
        Utils.clearAllErrors('expense-form');

        const id = document.getElementById('edit-expense-id').value;
        const amount = parseFloat(document.getElementById('exp-amount').value);
        const category = document.getElementById('exp-category').value;
        const desc = document.getElementById('exp-desc').value.trim();
        const date = document.getElementById('exp-date').value;

        let isValid = true;

        if (isNaN(amount) || amount <= 0) {
            Utils.showError('exp-amount-error', 'Please enter a valid amount greater than ₹0');
            isValid = false;
        }

        if (CONFIG.CATEGORIES.indexOf(category) === -1) {
            Toast.show('Invalid category selected', 'error');
            isValid = false;
        }

        if (desc.length === 0) {
            Utils.showError('exp-desc-error', 'Please enter a description');
            isValid = false;
        }

        if (!date || new Date(date) > new Date()) {
            Utils.showError('exp-date-error', 'Please select a valid date (not in future)');
            isValid = false;
        }

        if (!isValid) return;

        const data = { amount: amount, category: category, description: desc, date: date };

        var self = this;
        var promise;
        if (id) {
            promise = API.updateExpense(id, data);
        } else {
            promise = API.createExpense(data);
        }

        promise.then(function(result) {
            Modal.closeAll();
            App.refreshData();
            Toast.show(id ? 'Expense updated' : 'Expense recorded', 'success');
        }).catch(function(err) {
            Toast.show('Failed to save expense: ' + err.message, 'error');
        });
    },

    deleteExpense: function(id) {
        Modal.show('Confirm Delete',
            '<p style="margin-bottom:1.5rem; color:var(--text-muted)">Are you sure you want to remove this transaction? This action cannot be undone.</p>' +
            '<div class="modal-actions" style="display:flex; gap:1rem; justify-content:flex-end">' +
                '<button class="btn btn-secondary" onclick="Modal.closeAll()">Cancel</button>' +
                '<button class="btn btn-danger" id="confirm-delete-btn" style="background:var(--negative); color:#fff; border:none; padding:0.75rem 1.5rem; border-radius:12px; cursor:pointer; font-weight:600">Delete</button>' +
            '</div>',
            { wide: false }
        );
        document.getElementById('confirm-delete-btn').addEventListener('click', function() {
            Modal.closeAll();
            API.deleteExpense(id).then(function() {
                AppState.expenseOffset = 0;
                sessionStorage.removeItem(CONFIG.STORAGE_KEYS.EXPENSE_OFFSET);
                App.refreshData();
                Toast.show('Transaction removed', 'warning');
            }).catch(function(err) {
                Toast.show('Failed to delete: ' + err.message, 'error');
            });
        });
    },

    renderTable: function(expenses) {
        const cat = (document.getElementById('filter-category') || {}).value || 'all';
        const search = ((document.getElementById('expense-search') || {}).value || '').toLowerCase();

        const filtered = (expenses || AppState.expenses).filter(function(e) {
            const matchCat = cat === 'all' || e.category === cat;
            const desc = e.description || e.desc || '';
            const matchSearch = desc.toLowerCase().indexOf(search) !== -1 || e.category.toLowerCase().indexOf(search) !== -1;
            return matchCat && matchSearch;
        });

        const tbody = document.getElementById('expenses-tbody');
        if (!tbody) return;

        if (filtered.length === 0) {
            const hasFilters = cat !== 'all' || search.length > 0;
            if (hasFilters) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:4rem; color:var(--text-muted)">' +
                    '<div style="font-size:1.1rem; font-weight:700; margin-bottom:0.5rem">No results found</div>' +
                    '<div style="font-size:0.9rem">Try adjusting your filters or search query</div>' +
                '</td></tr>';
            } else {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:4rem; color:var(--text-muted)">' +
                    '<div style="font-size:2rem; margin-bottom:0.75rem"><i data-lucide="receipt" width="48" height="48" style="opacity:0.3"></i></div>' +
                    '<div style="font-size:1.1rem; font-weight:700; margin-bottom:0.5rem">No expenses yet</div>' +
                    '<div style="font-size:0.9rem; margin-bottom:1rem">Click <strong>Add Expense</strong> to get started on your financial journey</div>' +
                '</td></tr>';
            }
            if (window.lucide) lucide.createIcons();
            return;
        }

        let html = '';
        filtered.forEach(function(e) {
            const desc = Utils.escapeHTML(e.description || e.desc || '');
            const catColor = CONFIG.CATEGORY_COLORS[e.category] || '#6B7280';
            html += '<tr>' +
                '<td>' + Utils.formatDate(e.date) + '</td>' +
                '<td>' + desc + '</td>' +
                '<td><span class="badge" style="background:' + catColor + '20; color:' + catColor + '; border:1px solid ' + catColor + '40">' + Utils.escapeHTML(e.category) + '</span></td>' +
                '<td class="negative">-' + Utils.formatCurrency(e.amount) + '</td>' +
                '<td>' +
                    '<button onclick="ExpenseModule.openEditModal(\'' + e.id + '\')" class="icon-btn-small" style="color:var(--gold-primary); margin-right:0.5rem"><i data-lucide="edit"></i></button>' +
                    '<button onclick="ExpenseModule.deleteExpense(\'' + e.id + '\')" class="icon-btn-small" style="color:var(--negative)"><i data-lucide="trash-2"></i></button>' +
                '</td>' +
            '</tr>';
        });
        tbody.innerHTML = html;

        if (window.lucide) lucide.createIcons();
    },

    // Load More button
    renderLoadMore: function() {
        var container = document.getElementById('load-more-container');
        if (!container) return;
        if (AppState._hasMore && AppState.expenses.length > 0) {
            container.innerHTML = '<button class="btn btn-secondary" id="load-more-btn" style="width:100%; justify-content:center; padding:0.75rem">' +
                '<i data-lucide="chevron-down"></i> Load More (' + AppState.expenses.length + ' loaded)</button>';
            if (window.lucide) lucide.createIcons();
            document.getElementById('load-more-btn').addEventListener('click', function() {
                App.loadMoreExpenses();
            });
        } else if (AppState.expenses.length > 0) {
            container.innerHTML = '<div style="text-align:center; padding:0.75rem; color:var(--text-muted); font-size:0.85rem">' +
                'Showing all ' + AppState.expenses.length + ' expenses</div>';
        } else {
            container.innerHTML = '';
        }
    },

    // Filter persistence
    saveFilterState: function() {
        var cat = (document.getElementById('filter-category') || {}).value || 'all';
        var search = (document.getElementById('expense-search') || {}).value || '';
        sessionStorage.setItem(CONFIG.STORAGE_KEYS.FILTER_STATE, JSON.stringify({ category: cat, search: search }));
    },
    restoreFilterState: function() {
        var saved = sessionStorage.getItem(CONFIG.STORAGE_KEYS.FILTER_STATE);
        if (!saved) return;
        try {
            var f = JSON.parse(saved);
            var catEl = document.getElementById('filter-category');
            var searchEl = document.getElementById('expense-search');
            if (catEl && f.category) catEl.value = f.category;
            if (searchEl && f.search) searchEl.value = f.search;
        } catch(e) {}
    },

    exportCSV: function() {
        const BOM = '\uFEFF';
        let csv = BOM;

        // Section 1: Financial Summary
        csv += '=== FINANCIAL SUMMARY ===\n';
        csv += 'Current Balance,Total Budget,Total Expenses,Monthly Expenses\n';
        const stats = this.calculateStats();
        csv += Utils.formatCurrency(AppState.balance) + ',' +
                Utils.formatCurrency(AppState.budget) + ',' +
                Utils.formatCurrency(stats.totalAllTime) + ',' +
                Utils.formatCurrency(stats.totalMonthly) + '\n\n';

        // Section 2: Expense Transactions
        csv += '=== EXPENSE TRANSACTIONS ===\n';
        csv += 'Date,Description,Category,Amount (₹)\n';
        AppState.expenses.forEach(function(e) {
            csv += '"' + e.date + '","' +
                    e.desc.replace(/"/g, '""') + '","' +
                    e.category + '",' +
                    e.amount + '\n';
        });

        // Section 3: Investment Portfolio
        csv += '\n=== INVESTMENT PORTFOLIO ===\n';
        csv += 'Symbol,Name,Price (₹),Change (%),Status\n';
        InvestmentModule.stocks.forEach(function(s) {
            csv += '"' + s.symbol + '","' +
                    s.name + '",' +
                    s.price.toFixed(2) + ',' +
                    s.change + ',' +
                    (s.isPositive ? 'Up' : 'Down') + '\n';
        });

        // Section 4: IPO Watchlist
        csv += '\n=== IPO WATCHLIST ===\n';
        csv += 'Company,Price Range,Status,Date\n';
        InvestmentModule.ipos.forEach(function(ipo) {
            csv += '"' + ipo.company + '","' +
                    ipo.price + '","' +
                    ipo.status + '","' +
                    ipo.date + '"\n';
        });

        // Section 5: AI Insights
        csv += '\n=== AI INSIGHTS ===\n';
        csv += 'Title,Description,Type\n';
        const insights = InsightsModule.generate();
        insights.forEach(function(i) {
            csv += '"' + i.title + '","' +
                    i.desc.replace(/"/g, '""') + '","' +
                    i.type + '"\n';
        });

        csv += '\nExported on: ' + new Date().toLocaleString('en-IN') + '\n';

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fintrack_full_export_' + new Date().toISOString().split('T')[0] + '.csv';
        a.click();
        URL.revokeObjectURL(url);

        Toast.show('Full financial report exported with ' + AppState.expenses.length + ' transactions', 'success');
    }
};

// ==================== INVESTMENT MODULE ====================
const InvestmentModule = {
    stocks: [
        { symbol: 'RELIANCE.BSE', name: 'Reliance Industries', price: 2910.30, change: 1.15, isPositive: true },
        { symbol: 'TCS.BSE', name: 'Tata Consultancy Services', price: 3982.10, change: -1.20, isPositive: false },
        { symbol: 'INFY.BSE', name: 'Infosys Limited', price: 1515.45, change: 0.85, isPositive: true },
        { symbol: 'HDFCBANK.BSE', name: 'HDFC Bank', price: 1445.60, change: 0.45, isPositive: true }
    ],

    ipos: [
        { id: 1, company: 'Waaree Energies', price: '₹1,427 - ₹1,503', status: 'live', date: 'Oct 21 - Oct 23' },
        { id: 2, company: 'Hyundai India', price: '₹1,865 - ₹1,960', status: 'closed', date: 'Oct 15 - Oct 17' },
        { id: 3, company: 'Swiggy Limited', price: '₹370 - ₹395', status: 'upcoming', date: 'Nov 06 - Nov 08' }
    ],

    startStockUpdates: function() {
        if (AppState.stockUpdateInterval) {
            clearInterval(AppState.stockUpdateInterval);
        }

        this.fetchStockPrices();

        AppState.stockUpdateInterval = setInterval(function() {
            if (AppState.currentView === 'investments' || AppState.currentView === 'dashboard') {
                InvestmentModule.fetchStockPrices();
            }
        }, CONFIG.STOCK_UPDATE_INTERVAL);
    },

    fetchStockPrices: function() {
        const config = AppState.apiConfig;

        if (!config.key) {
            this.updateWithMockData();
            return;
        }

        const loadingEl = document.getElementById('stock-loading');
        if (loadingEl) loadingEl.classList.remove('hidden');

        const self = this;
        const promises = this.stocks.map(function(stock) {
            return self.fetchSingleStock(stock.symbol, config).then(function(price) {
                if (price !== null) {
                    const oldPrice = stock.price;
                    stock.price = price;
                    stock.change = ((price - oldPrice) / oldPrice * 100).toFixed(2);
                    stock.isPositive = stock.change >= 0;
                }
            });
        });

        Promise.all(promises).then(function() {
            self.renderWatchlist();
            self.updateMarketTicker();
        }).catch(function(error) {
            console.error('Failed to fetch stock prices:', error);
            self.updateWithMockData();
        }).finally(function() {
            if (loadingEl) loadingEl.classList.add('hidden');
        });
    },

    fetchSingleStock: function(symbol, config) {
        return new Promise(function(resolve) {
            let url;
            switch (config.provider) {
                case 'alpha_vantage':
                    url = CONFIG.API.ALPHA_VANTAGE_BASE + '?function=GLOBAL_QUOTE&symbol=' + symbol + '&apikey=' + config.key;
                    break;
                case 'iex_cloud':
                    const iexSymbol = symbol.split('.')[0];
                    url = CONFIG.API.IEX_BASE + '/stock/' + iexSymbol + '/quote?token=' + config.key;
                    break;
                default:
                    resolve(null);
                    return;
            }

            fetch(url).then(function(res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            }).then(function(data) {
                if (config.provider === 'alpha_vantage') {
                    if (data['Error Message'] || data['Note']) {
                        console.warn('API Limit or Error:', data);
                        resolve(null);
                        return;
                    }
                    const quote = data['Global Quote'];
                    if (quote && quote['05. price']) {
                        resolve(parseFloat(quote['05. price']));
                    } else {
                        resolve(null);
                    }
                } else if (config.provider === 'iex_cloud') {
                    if (data.latestPrice) {
                        resolve(parseFloat(data.latestPrice));
                    } else {
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            }).catch(function(error) {
                console.error('Failed to fetch ' + symbol + ':', error);
                resolve(null);
            });
        });
    },

    updateWithMockData: function() {
        this.stocks.forEach(function(s) {
            const change = (Math.random() - 0.5) * 2;
            s.price += (s.price * (change / 100));
            s.change = change.toFixed(2);
            s.isPositive = change >= 0;
        });

        this.renderWatchlist();
        this.updateMarketTicker();
    },

    updateMarketTicker: function() {
        const nifty = document.getElementById('nifty-50');
        const sensex = document.getElementById('sensex');

        if (nifty) {
            const nPrice = 22096 + (Math.random() - 0.5) * 100;
            nifty.querySelector('.ticker-price').textContent = nPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 });
        }
        if (sensex) {
            const sPrice = 72831 + (Math.random() - 0.5) * 200;
            sensex.querySelector('.ticker-price').textContent = sPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 });
        }
    },

    renderWatchlist: function() {
        const list = document.getElementById('stock-watchlist');
        if (!list) return;

        let html = '';
        this.stocks.forEach(function(s) {
            html += '<div class="stock-item">' +
                '<div class="stock-info">' +
                    '<span style="font-weight:800; display:block;">' + s.symbol.replace('.BSE', '') + '</span>' +
                    '<span style="font-size:0.8rem; color:var(--text-muted)">' + Utils.escapeHTML(s.name) + '</span>' +
                '</div>' +
                '<div style="text-align:right">' +
                    '<span style="font-weight:700">' + Utils.formatCurrency(s.price) + '</span>' +
                    '<span class="' + (s.isPositive ? 'positive' : 'negative') + '" style="display:block; font-size:0.85rem">' +
                        (s.isPositive ? '▲' : '▼') + ' ' + Math.abs(s.change) + '%' +
                    '</span>' +
                '</div>' +
            '</div>';
        });
        list.innerHTML = html;
    },

    renderIPOList: function() {
        const tbody = document.getElementById('ipo-tbody');
        if (!tbody) return;

        let html = '';
        this.ipos.forEach(function(ipo) {
            html += '<tr>' +
                '<td>' +
                    '<div style="font-weight:700">' + Utils.escapeHTML(ipo.company) + '</div>' +
                    '<div style="font-size:0.75rem; color:var(--text-muted)">' + ipo.date + '</div>' +
                '</td>' +
                '<td>' + Utils.escapeHTML(ipo.price) + '</td>' +
                '<td><span class="ipo-status ' + ipo.status + '">' + ipo.status.toUpperCase() + '</span></td>' +
                '<td>' +
                    '<button class="btn btn-secondary btn-sm" onclick="Toast.show(\'IPO application feature coming soon!\', \'info\')">' +
                        (ipo.status === 'live' ? 'Apply Now' : 'View Details') +
                    '</button>' +
                '</td>' +
            '</tr>';
        });
        tbody.innerHTML = html;
    },

    renderPortfolioSummary: function() {
        const portfolioValue = 1245000 + (Math.random() - 0.5) * 5000;
        const investedAmount = 1000000;

        const portfolioEl = document.getElementById('portfolio-value');
        const investedEl = document.getElementById('invested-amount');

        if (portfolioEl) portfolioEl.textContent = Utils.formatCurrency(portfolioValue);
        if (investedEl) investedEl.textContent = Utils.formatCurrency(investedAmount);
    },

    render: function() {
        this.renderWatchlist();
        this.renderIPOList();
        this.renderPortfolioSummary();
    },

    handleAPIConfig: function(e) {
        e.preventDefault();
        Utils.clearAllErrors('api-config-form');

        const provider = document.getElementById('api-provider').value;
        const key = document.getElementById('api-key').value.trim();

        if (!key) {
            Utils.showError('api-key-error', 'Please enter your API key');
            return;
        }

        AppState.apiConfig = { provider: provider, key: key };
        localStorage.setItem(CONFIG.STORAGE_KEYS.API_CONFIG, JSON.stringify(AppState.apiConfig));

        Modal.closeAll();
        Toast.show('API Configuration saved! Fetching latest data...', 'success');

        this.fetchStockPrices();
    }
};

// ==================== CHART MODULE ====================
const ChartModule = {
    renderSpendingTrend: function() {
        try {
            const canvas = document.getElementById('spendingTrendChart');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            if (AppState.charts.trend) {
                AppState.charts.trend.destroy();
            }

            if (typeof Chart === 'undefined') {
                console.warn('Chart.js not loaded');
                return;
            }

            const dailyTotals = {};
            AppState.expenses.forEach(function(exp) {
                if (!dailyTotals[exp.date]) dailyTotals[exp.date] = 0;
                dailyTotals[exp.date] += exp.amount;
            });

            const sortedDates = Object.keys(dailyTotals).sort(function(a, b) { return new Date(a) - new Date(b); });
            const fixedLength = 7;

            const chartData = sortedDates.slice(-fixedLength).map(function(date) {
                return {
                    date: date,
                    label: new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                    amount: dailyTotals[date]
                };
            });

            while (chartData.length < fixedLength) {
                chartData.unshift({ date: '', label: '-', amount: 0 });
            }

            const labels = chartData.map(function(d) { return d.label; });
            const data = chartData.map(function(d) { return d.amount; });
            const totalSpent = data.reduce(function(a, b) { return a + b; }, 0);
            const maxSpend = Math.max.apply(null, data);
            const maxSpendIdx = data.indexOf(maxSpend);

            const isDark = AppState.theme === 'dark';
            const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
            const textColor = isDark ? '#94a3b8' : '#64748b';

            const avgSpent = totalSpent / fixedLength;
            const todaySpent = data[fixedLength - 1];
            const trendText = todaySpent > avgSpent
                ? '<span class="negative">▲ Above average</span>'
                : '<span class="positive">▼ Below average</span>';

            const header = document.querySelector('.chart-header');
            if (header) {
                header.innerHTML = '<div>' +
                    '<h3>Spending Trend</h3>' +
                    '<p style="font-size:0.75rem; color:var(--text-muted)">Daily avg: ' + Utils.formatCurrency(Math.round(avgSpent)) + '</p>' +
                '</div>' +
                '<div style="text-align:right">' + trendText + '</div>';
            }

            AppState.charts.trend = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Daily Spend',
                        data: data,
                        borderColor: '#6366f1',
                        borderWidth: 4,
                        tension: 0.4,
                        pointRadius: data.map(function(v, i) { return v > 0 ? (i === maxSpendIdx ? 8 : 4) : 0; }),
                        pointHoverRadius: 10,
                        pointBackgroundColor: data.map(function(v, i) { return i === maxSpendIdx ? '#ef4444' : '#6366f1'; }),
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        fill: true,
                        backgroundColor: 'rgba(99, 102, 241, 0.1)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 1000,
                        easing: 'easeOutQuart'
                    },
                    onClick: function(e, elements) {
                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const clickedDate = chartData[index].date;
                            if (!clickedDate) return;
                            App.switchToView('expenses', clickedDate);
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: isDark ? '#1e293b' : '#fff',
                            titleColor: isDark ? '#f8fafc' : '#1e293b',
                            bodyColor: isDark ? '#94a3b8' : '#64748b',
                            borderColor: 'var(--glass-border)',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: false,
                            callbacks: {
                                label: function(context) { return 'Spent: ' + Utils.formatCurrency(context.raw); }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: gridColor },
                            ticks: { color: textColor, callback: function(value) { return '₹' + value.toLocaleString('en-IN'); } }
                        },
                        x: { grid: { display: false }, ticks: { color: textColor } }
                    }
                }
            });

        } catch (e) {
            console.error('Chart rendering failed:', e);
        }
    }
};

// ==================== INSIGHTS MODULE ====================
const InsightsModule = {
    generate: function() {
        const stats = ExpenseModule.calculateStats();
        const insights = [];

        if (AppState.budget > 0 && stats.totalMonthly > AppState.budget * 0.9) {
            insights.push({
                title: 'Budget Alert',
                desc: 'You have used over 90% of your monthly budget (' + Utils.formatCurrency(AppState.budget) + '). Consider pausing non-essential spending.',
                type: 'error'
            });
        }

        if (AppState.expenses.length > 0) {
            const categoryCounts = {};
            AppState.expenses.forEach(function(e) {
                categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
            });

            let topCategory = null;
            let topCount = 0;
            Object.keys(categoryCounts).forEach(function(cat) {
                if (categoryCounts[cat] > topCount) {
                    topCount = categoryCounts[cat];
                    topCategory = cat;
                }
            });

            if (topCategory) {
                insights.push({
                    title: 'Spending Pattern',
                    desc: 'Most of your transactions are in "' + topCategory + '" category (' + topCount + ' transactions). Consider diversifying your spending.',
                    type: 'warning'
                });
            }
        }

        const budgetUsedPercent = AppState.budget > 0 ? (stats.totalMonthly / AppState.budget * 100) : 0;
        if (budgetUsedPercent < 70) {
            insights.push({
                title: 'Savings Opportunity',
                desc: 'You\'ve only used ' + Math.round(budgetUsedPercent) + '% of your budget. Consider investing the surplus in Index Funds for long-term growth.',
                type: 'info'
            });
        } else {
            insights.push({
                title: 'Savings Tip',
                desc: 'Diversify your portfolio with Index Funds for long-term wealth growth.',
                type: 'info'
            });
        }

        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysLeft = daysInMonth - now.getDate();
        if (daysLeft <= 5 && budgetUsedPercent > 80) {
            insights.push({
                title: 'Month-End Alert',
                desc: 'Only ' + daysLeft + ' days left in the month and you\'ve used ' + Math.round(budgetUsedPercent) + '% of your budget. Plan carefully!',
                type: 'warning'
            });
        }

        AppState.insightsCache = insights;
        return insights;
    },

    renderMini: function() {
        const container = document.getElementById('insights-list-mini');
        if (!container) return;

        const insights = this.generate().slice(0, 2);
        let html = '';
        insights.forEach(function(i) {
            const borderColor = i.type === 'error' ? 'negative' : (i.type === 'warning' ? 'warning' : 'primary-color');
            html += '<div class="insight-item" style="border-left: 5px solid var(--' + borderColor + ')">' +
                '<h4>' + Utils.escapeHTML(i.title) + '</h4>' +
                '<p>' + Utils.escapeHTML(i.desc) + '</p>' +
            '</div>';
        });
        container.innerHTML = html;
    },

    renderFull: function() {
        const list = document.getElementById('full-insights-list');
        if (!list) return;

        const insights = this.generate();
        let html = '';
        insights.forEach(function(i) {
            const borderColor = i.type === 'error' ? 'negative' : (i.type === 'warning' ? 'warning' : 'primary-color');
            html += '<div class="summary-card" style="border-left: 8px solid var(--' + borderColor + ')">' +
                '<h3>' + Utils.escapeHTML(i.title) + '</h3>' +
                '<p>' + Utils.escapeHTML(i.desc) + '</p>' +
            '</div>';
        });
        list.innerHTML = html;
    }
};

// ==================== MODAL MODULE ====================
const Modal = {
    open: function(id) {
        if (id === 'api-config-modal') {
            document.getElementById('api-provider').value = AppState.apiConfig.provider;
            document.getElementById('api-key').value = AppState.apiConfig.key;
        }
        var el = document.getElementById(id);
        if (el) el.classList.add('active');
    },

    closeAll: function() {
        document.querySelectorAll('.modal').forEach(function(m) { m.classList.remove('active'); });
    },

    // Create a dynamic modal on-the-fly
    show: function(title, bodyHtml, opts) {
        opts = opts || {};
        var id = 'dynamic-modal-' + Date.now();
        var div = document.createElement('div');
        div.className = 'modal active';
        div.id = id;
        div.innerHTML =
            '<div class="modal-content' + (opts.wide === false ? ' small' : '') + '">' +
                '<div class="modal-header">' +
                    '<h2>' + (title || '') + '</h2>' +
                    '<button class="close-modal" onclick="Modal.closeAll()"><i data-lucide="x"></i></button>' +
                '</div>' +
                '<div class="modal-body">' + (bodyHtml || '') + '</div>' +
            '</div>';
        // Close on overlay click
        div.addEventListener('click', function(e) {
            if (e.target === div) Modal.closeAll();
        });
        document.body.appendChild(div);
        if (window.lucide) lucide.createIcons();
        // Auto-remove when closed
        var observer = new MutationObserver(function() {
            if (!div.classList.contains('active')) {
                setTimeout(function() { if (div.parentNode) div.parentNode.removeChild(div); }, 300);
                observer.disconnect();
            }
        });
        observer.observe(div, { attributes: true, attributeFilter: ['class'] });
    }
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    App.init();
    if (window.lucide) {
        lucide.createIcons();
    }
});

// ==================== GLOBAL SEARCH ====================
App.handleGlobalSearch = function(e) {
    const query = e.target.value.toLowerCase().trim();
    const resultsContainer = document.getElementById('global-search-results');

    if (!resultsContainer) return;

    if (query === '') {
        resultsContainer.classList.add('hidden');
        return;
    }

    if (AppState.currentView === 'expenses') {
        const expSearch = document.getElementById('expense-search');
        if (expSearch) {
            expSearch.value = query;
            ExpenseModule.renderTable();
        }
    }

    const matchedExpenses = AppState.expenses.filter(function(exp) {
        return exp.desc.toLowerCase().indexOf(query) !== -1 ||
               exp.category.toLowerCase().indexOf(query) !== -1;
    }).slice(0, 5);

    const matchedStocks = InvestmentModule.stocks.filter(function(s) {
        return s.symbol.toLowerCase().indexOf(query) !== -1 ||
               s.name.toLowerCase().indexOf(query) !== -1;
    });

    const matchedIPOs = InvestmentModule.ipos.filter(function(ipo) {
        return ipo.company.toLowerCase().indexOf(query) !== -1;
    });

    const insights = InsightsModule.generate();
    const matchedInsights = insights.filter(function(i) {
        return i.title.toLowerCase().indexOf(query) !== -1 ||
               i.desc.toLowerCase().indexOf(query) !== -1;
    });

    let html = '';

    if (matchedExpenses.length > 0) {
        html += '<div class="search-result-group"><div class="search-result-group-title">Transactions</div>';
        matchedExpenses.forEach(function(exp) {
            const descEscaped = Utils.escapeHTML(exp.desc).replace(/'/g, "\\'");
            html += '<div class="search-result-item" onclick="App.switchToView(\'expenses\', \'' + descEscaped + '\')">' +
                '<div>' +
                    '<div class="result-title">' + Utils.escapeHTML(exp.desc) + '</div>' +
                    '<div class="result-sub">' + exp.category + ' • ' + Utils.formatDate(exp.date) + '</div>' +
                '</div>' +
                '<div class="negative">-' + Utils.formatCurrency(exp.amount) + '</div>' +
            '</div>';
        });
        html += '</div>';
    }

    if (matchedStocks.length > 0 || matchedIPOs.length > 0) {
        html += '<div class="search-result-group"><div class="search-result-group-title">Investments</div>';

        matchedStocks.forEach(function(s) {
            html += '<div class="search-result-item" onclick="App.switchToView(\'investments\')">' +
                '<div>' +
                    '<div class="result-title">' + s.symbol.replace('.BSE', '') + '</div>' +
                    '<div class="result-sub">' + Utils.escapeHTML(s.name) + '</div>' +
                '</div>' +
                '<div>' + Utils.formatCurrency(s.price) + '</div>' +
            '</div>';
        });

        matchedIPOs.forEach(function(ipo) {
            html += '<div class="search-result-item" onclick="App.switchToView(\'investments\')">' +
                '<div>' +
                    '<div class="result-title">' + Utils.escapeHTML(ipo.company) + '</div>' +
                    '<div class="result-sub">IPO • ' + ipo.status.toUpperCase() + '</div>' +
                '</div>' +
                '<div>' + Utils.escapeHTML(ipo.price) + '</div>' +
            '</div>';
        });

        html += '</div>';
    }

    if (matchedInsights.length > 0) {
        html += '<div class="search-result-group"><div class="search-result-group-title">Insights</div>';
        matchedInsights.forEach(function(insight) {
            html += '<div class="search-result-item" onclick="App.switchToView(\'insights\')">' +
                '<div>' +
                    '<div class="result-title">' + Utils.escapeHTML(insight.title) + '</div>' +
                    '<div class="result-sub">' + Utils.escapeHTML(insight.desc).substring(0, 45) + '...</div>' +
                '</div>' +
            '</div>';
        });
        html += '</div>';
    }

    if (html === '') {
        html = '<div style="padding:1.5rem; text-align:center; color:var(--text-muted); font-size:0.9rem;">No results found for "' + Utils.escapeHTML(query) + '"</div>';
    }

    resultsContainer.innerHTML = html;
    resultsContainer.classList.remove('hidden');

    if (window.lucide) lucide.createIcons();
};

// ==================== VIEW SWITCHING ====================
App.switchView = function(viewId) {
    AppState.currentView = viewId;

    document.querySelectorAll('.nav-item').forEach(function(i) {
        i.classList.toggle('active', i.getAttribute('data-view') === viewId);
    });

    document.querySelectorAll('.view').forEach(function(v) {
        v.classList.toggle('active', v.id === viewId || v.id === viewId + '-view');
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    switch(viewId) {
        case 'expenses':
            ExpenseModule.restoreFilterState();
            App.refreshData();
            break;
        case 'insights':
            InsightsModule.renderFull();
            break;
        case 'investments':
            InvestmentModule.render();
            EconomistTeam.renderTeam();
            break;
        case 'dashboard':
            App.refreshData();
            break;
    }
};

App.switchToView = function(viewId, searchVal) {
    const resultsContainer = document.getElementById('global-search-results');
    if (resultsContainer) resultsContainer.classList.add('hidden');

    document.getElementById('global-search').value = searchVal || '';
    App.switchView(viewId);

    if (viewId === 'expenses' && searchVal) {
        const expSearch = document.getElementById('expense-search');
        if (expSearch) {
            expSearch.value = searchVal;
            ExpenseModule.renderTable();
        }
    }
};

// ==================== NOTIFICATIONS ====================
App.updateNotificationBadge = function() {
    const badge = document.querySelector('.notification-badge');
    if (!badge) return;

    const insights = InsightsModule.generate();
    var alertCount = 0;
    insights.forEach(function(i) {
        if (i.type === 'error' || i.type === 'warning') {
            alertCount++;
        }
    });

    if (alertCount > 0) {
        badge.textContent = alertCount > 9 ? '9+' : alertCount;
        badge.style.display = '';
    } else {
        badge.textContent = '';
        badge.style.display = 'none';
    }
};

App.handleNotifications = function() {
    var insights = InsightsModule.generate();
    var activeAlerts = [];
    insights.forEach(function(i) {
        if (i.type === 'error' || i.type === 'warning') {
            activeAlerts.push(i);
        }
    });

    if (activeAlerts.length === 0) {
        Toast.show('No new notifications. Your finances look good!', 'success');
        return;
    }

    var latest = activeAlerts[0];
    var count = activeAlerts.length;
    var message = '\u26A0 ' + latest.title + ': ' + latest.desc.substring(0, 80);
    if (count > 1) {
        message += ' (+' + (count - 1) + ' more alert' + (count > 2 ? 's' : '') + ')';
    }
    Toast.show(message, 'warning');
};

App.renderAll = function() {
    try {
        App.updateNotificationBadge();
        const stats = ExpenseModule.calculateStats();

        const balanceEl = document.getElementById('display-balance');
        const budgetEl = document.getElementById('display-budget');
        const expensesEl = document.getElementById('display-expenses');

        if (balanceEl) balanceEl.textContent = Utils.formatCurrency(AppState.balance - stats.totalAllTime);
        if (budgetEl) budgetEl.textContent = Utils.formatCurrency(AppState.budget);
        if (expensesEl) expensesEl.textContent = Utils.formatCurrency(stats.totalMonthly);

        const percent = AppState.budget > 0 ? Math.min(100, (stats.totalMonthly / AppState.budget) * 100) : 0;
        const pBar = document.getElementById('budget-progress-bar');
        if (pBar) {
            pBar.style.width = percent + '%';
            pBar.style.backgroundColor = percent > 90 ? 'var(--negative)' : (percent > 70 ? 'var(--gold-secondary)' : 'var(--gold-primary)');
        }
        const pText = document.getElementById('budget-progress-text');
        if (pText) pText.textContent = Math.round(percent) + '% of budget used';

        InsightsModule.renderMini();

        if (AppState.currentView === 'dashboard') {
            ChartModule.renderSpendingTrend();
        }

    } catch (err) {
        console.error('Render All failed:', err);
    }
};

App.saveState = function() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.BALANCE, AppState.balance);
    localStorage.setItem(CONFIG.STORAGE_KEYS.BUDGET, AppState.budget);
    localStorage.setItem(CONFIG.STORAGE_KEYS.EXPENSES, JSON.stringify(AppState.expenses));
};

App.handleSetup = function(e) {
    e.preventDefault();
    Utils.clearAllErrors('setup-form');

    const balance = parseFloat(document.getElementById('set-balance').value);
    const budget = parseFloat(document.getElementById('set-budget').value);

    let isValid = true;

    if (isNaN(balance) || balance < 0) {
        Utils.showError('set-balance-error', 'Please enter a valid balance (₹0 or more)');
        isValid = false;
    }

    if (isNaN(budget) || budget <= 0) {
        Utils.showError('set-budget-error', 'Please enter a valid budget (₹1 or more)');
        isValid = false;
    }

    if (!isValid) return;

    API.updateSettings({ balance: balance, budget: budget }).then(function(data) {
        AppState.balance = data.user.balance;
        AppState.budget = data.user.budget;
        localStorage.setItem(CONFIG.STORAGE_KEYS.BALANCE, data.user.balance);
        localStorage.setItem(CONFIG.STORAGE_KEYS.BUDGET, data.user.budget);
        localStorage.setItem(CONFIG.STORAGE_KEYS.SETUP_COMPLETE, 'true');
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(data.user));
        Modal.closeAll();
        App.renderAll();
        Toast.show('Setup complete! Start tracking your expenses.', 'success');
    }).catch(function(err) {
        // Fallback to localStorage if API not available
        AppState.balance = balance;
        AppState.budget = budget;
        localStorage.setItem(CONFIG.STORAGE_KEYS.BALANCE, balance);
        localStorage.setItem(CONFIG.STORAGE_KEYS.BUDGET, budget);
        localStorage.setItem(CONFIG.STORAGE_KEYS.SETUP_COMPLETE, 'true');
        Modal.closeAll();
        App.renderAll();
        Toast.show('Setup complete! Start tracking your expenses.', 'success');
    });
}


// ==================== AI STOCK MANAGER ====================
const AIStockManager = {
    analyzePortfolio: function() {
        const stocks = InvestmentModule.stocks;
        const recommendations = [];
        
        stocks.forEach(function(stock) {
            let recommendation = {
                symbol: stock.symbol,
                name: stock.name,
                currentPrice: stock.price,
                action: 'HOLD',
                confidence: 0,
                reason: ''
            };
            
            // AI analysis logic
            if (stock.change > 2) {
                recommendation.action = 'BUY';
                recommendation.confidence = Math.min(95, 50 + stock.change * 10);
                recommendation.reason = 'Strong upward trend (+' + stock.change + '%). Consider buying more.';
            } else if (stock.change < -2) {
                recommendation.action = 'SELL';
                recommendation.confidence = Math.min(90, 50 + Math.abs(stock.change) * 10);
                recommendation.reason = 'Declining trend (' + stock.change + '%). Consider selling.';
            } else {
                recommendation.action = 'HOLD';
                recommendation.confidence = 60;
                recommendation.reason = 'Stable performance. Hold for now.';
            }
            
            recommendations.push(recommendation);
        });
        
        return recommendations;
    },
    
    renderRecommendations: function() {
        const container = document.getElementById('ai-rec-list');
        if (!container) return;
        
        const recommendations = this.analyzePortfolio();
        
        let html = '';
        recommendations.forEach(function(rec) {
            const actionColor = rec.action === 'BUY' ? 'positive' : (rec.action === 'SELL' ? 'negative' : 'warning');
            html += '<div class="rec-item">' +
                '<div>' +
                    '<strong>' + rec.symbol.replace('.BSE', '') + '</strong>' +
                    '<span class="' + actionColor + '">' + rec.action + ' (' + rec.confidence + '%)</span>' +
                '</div>' +
                '<p>' + rec.reason + '</p>' +
            '</div>';
        });
        
        container.innerHTML = html;
    }
};

// ==================== ECONOMIST TEAM ====================
const EconomistTeam = {
    members: [
        { id: 1, name: 'Dr. Arjun Patel', role: 'Macro Economist', specialty: 'Monetary Policy & Inflation', accuracy: 94, avatar: 'AP' },
        { id: 2, name: 'Priya Sharma', role: 'Market Analyst', specialty: 'Technical Analysis', accuracy: 91, avatar: 'PS' },
        { id: 3, name: 'Raj Kumar', role: 'Behavioral Economist', specialty: 'Consumer Spending', accuracy: 88, avatar: 'RK' },
        { id: 4, name: 'Anita Desai', role: 'Investment Strategist', specialty: 'Portfolio Management', accuracy: 96, avatar: 'AD' },
        { id: 5, name: 'Vikram Singh', role: 'FinTech Expert', specialty: 'Digital Payments & Crypto', accuracy: 89, avatar: 'VS' }
    ],
    
    renderTeam: function() {
        const container = document.getElementById('economist-team');
        if (!container) return;
        
        let html = '';
        this.members.forEach(function(member) {
            html += '<div class="economist-card">' +
                '<div class="economist-avatar">' + member.avatar + '</div>' +
                '<div class="economist-info">' +
                    '<h4>' + member.name + '</h4>' +
                    '<p class="role">' + member.role + '</p>' +
                    '<p class="specialty">' + member.specialty + '</p>' +
                '</div>' +
                '<div class="accuracy">' +
                    '<span>' + member.accuracy + '%</span>' +
                    '<small>accuracy</small>' +
                '</div>' +
            '</div>';
        });
        
        container.innerHTML = html;
    },
    
    getAdvice: function(topic) {
        const advisors = this.members.filter(function(m) {
            return m.specialty.toLowerCase().indexOf(topic.toLowerCase()) !== -1;
        });
        
        if (advisors.length === 0) {
            return this.members[Math.floor(Math.random() * this.members.length)];
        }
        
        return advisors[0];
    }
};

// ==================== AI CHATBOT ====================
const AIChatbot = {
    isOpen: false,
    conversationHistory: [],
    
    init: function() {
        const openBtn = document.getElementById('open-chatbot');
        const closeBtn = document.getElementById('close-chatbot');
        const minimizeBtn = document.getElementById('minimize-chatbot');
        const sendBtn = document.getElementById('send-chat');
        const input = document.getElementById('chat-input');
        
        if (openBtn) {
            openBtn.addEventListener('click', function() { AIChatbot.open(); });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', function() { AIChatbot.close(); });
        }
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', function() { AIChatbot.minimize(); });
        }
        if (sendBtn) {
            sendBtn.addEventListener('click', function() { AIChatbot.sendMessage(); });
        }
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    AIChatbot.sendMessage();
                }
            });
        }
    },
    
    open: function() {
        const chatbox = document.getElementById('ai-chatbot');
        if (chatbox) {
            chatbox.classList.remove('hidden');
            this.isOpen = true;
        }
    },
    
    close: function() {
        const chatbox = document.getElementById('ai-chatbot');
        if (chatbox) {
            chatbox.classList.add('hidden');
            this.isOpen = false;
        }
    },
    
    minimize: function() {
        // Same as close - hides the chatbot
        this.close();
    },
    
    sendMessage: function() {
        const input = document.getElementById('chat-input');
        if (!input || !input.value.trim()) return;
        
        const message = input.value.trim();
        input.value = '';
        
        this.addMessage(message, 'user');
        
        // Simulate AI thinking
        setTimeout(function() {
            const response = AIChatbot.generateResponse(message);
            AIChatbot.addMessage(response, 'ai');
        }, 1000);
    },
    
    addMessage: function(text, sender) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = sender === 'user' ? 'message user-message' : 'message ai-message';
        messageDiv.innerHTML = '<p>' + Utils.escapeHTML(text) + '</p>';
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },
    
    generateResponse: function(question) {
        question = question.toLowerCase();
        const stats = ExpenseModule.calculateStats();
        const budgetUsedPercent = AppState.budget > 0 ? Math.round(stats.totalMonthly / AppState.budget * 100) :0;
        const remaining = AppState.budget - stats.totalMonthly;

        // Calculate category breakdown for use across multiple query types
        const categoryBreakdown = {};
        AppState.expenses.forEach(function(e) {
            categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount;
        });

        // Greeting
        if (question.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
            const name = AppState.user ? AppState.user.name.split(' ')[0] : 'there';
            const hour = new Date().getHours();
            const greeting = hour < 12 ? 'Good morning' : (hour < 17 ? 'Good afternoon' : 'Good evening');
            return greeting + ', ' + name + '! I\'m your FinTrack AI assistant. You have ' + AppState.expenses.length + ' expenses tracked. How can I help you today?';
        }

        // Balance query
        if (question.includes('balance') || question.includes('total balance') || question.includes('how much')) {
            const netWorth = AppState.balance - stats.totalAllTime;
            return 'Your current balance is ' + Utils.formatCurrency(AppState.balance) + '. After all expenses, your net worth is ' + Utils.formatCurrency(netWorth) + '. You have ' + AppState.expenses.length + ' recorded expenses totaling ' + Utils.formatCurrency(stats.totalAllTime) + '.';
        }

        // Expense query - detailed
        if (question.includes('expense') || question.includes('spending') || question.includes('spent')) {
            let response = 'This month you\'ve spent ' + Utils.formatCurrency(stats.totalMonthly) + ' out of ' + Utils.formatCurrency(AppState.budget) + ' budget (' + budgetUsedPercent + '% used). ';

            if (budgetUsedPercent > 90) {
                response += '⚠️ Warning: You\'ve used over 90% of your budget! ';
            } else if (budgetUsedPercent > 70) {
                response += '⚠️ You\'ve used over 70% of your budget. ';
            }

            response += 'Top category: ' + stats.topCategory + '. ';

            // Add category breakdown
            const topCategories = Object.keys(categoryBreakdown).sort(function(a, b) {
                return categoryBreakdown[b] - categoryBreakdown[a];
            }).slice(0, 3);

            if (topCategories.length > 0) {
                response += 'Top spending: ';
                topCategories.forEach(function(cat, idx) {
                    response += cat + ' (' + Utils.formatCurrency(categoryBreakdown[cat]) + ')';
                    if (idx < topCategories.length - 1) response += ', ';
                });
            }

            return response;
        }

        // Budget query
        if (question.includes('budget') || question.includes('limit') || question.includes('remaining')) {
            let response = 'Monthly budget: ' + Utils.formatCurrency(AppState.budget) + '. ';
            response += 'Used: ' + budgetUsedPercent + '% (' + Utils.formatCurrency(stats.totalMonthly) + '). ';
            response += 'Remaining: ' + Utils.formatCurrency(remaining) + '. ';

            if (remaining < 0) {
                response += '⚠️ You\'ve exceeded your budget by ' + Utils.formatCurrency(Math.abs(remaining)) + '!';
            } else if (remaining < AppState.budget * 0.1) {
                response += '⚠️ Only ' + Utils.formatCurrency(remaining) + ' left in budget.';
            } else {
                response += 'You\'re on track!';
            }

            return response;
        }

        // Portfolio analysis
        if (question.includes('portfolio') || question.includes('investment') || question.includes('stock')) {
            const recommendations = AIStockManager.analyzePortfolio();
            let response = 'Portfolio Analysis:\n\n';

            // Add stock summary
            const gainers = InvestmentModule.stocks.filter(function(s) { return s.isPositive; }).length;
            response += 'You\'re tracking ' + InvestmentModule.stocks.length + ' stocks (' + gainers + ' gainers, ' + (InvestmentModule.stocks.length - gainers) + ' decliners).\n\n';

            // Add recommendations
            response += 'Recommendations:\n';
            recommendations.slice(0, 3).forEach(function(rec) {
                const actionEmoji = rec.action === 'BUY' ? '🟢' : (rec.action === 'SELL' ? '🔴' : '🟡');
                response += actionEmoji + ' ' + rec.symbol.replace('.BSE', '') + ' - ' + rec.action + ' (' + rec.confidence + '% confidence)\n';
            });

            // Add IPO info
            const liveIPOs = InvestmentModule.ipos.filter(function(i) { return i.status === 'live'; }).length;
            if (liveIPOs > 0) {
                response += '\n📋 ' + liveIPOs + ' IPO(s) currently open for subscription.';
            }

            return response;
        }

        // Market advice
        if (question.includes('market') || question.includes('nifty') || question.includes('sensex')) {
            const economist = EconomistTeam.getAdvice('Market');
            const niftyChange = (Math.random() - 0.5) * 2;
            const sensexChange = (Math.random() - 0.5) * 2;

            return '📊 Market Update (Simulated):\n\n' +
                   'NIFTY 50: ' + (niftyChange >= 0 ? '▲' : '▼') + ' ' + Math.abs(niftyChange).toFixed(2) + '%\n' +
                   'SENSEX: ' + (sensexChange >= 0 ? '▲' : '▼') + ' ' + Math.abs(sensexChange).toFixed(2) + '%\n\n' +
                   'According to ' + economist.name + ' (' + economist.role + '):\n' +
                   '"Market shows mixed signals with volatility at ' + (10 + Math.random() * 5).toFixed(1) + '%. ' +
                   'Consider diversifying across sectors like IT, Banking, and Energy. ' +
                   'Gold allocation (5-10%) can hedge against market volatility."';
        }

        // Savings query
        if (question.includes('save') || question.includes('saving') || question.includes('suggestion') || question.includes('tip') || question.includes('advice')) {
            let response = '💡 Savings Tips:\n\n';

            // Personalized based on spending
            if (stats.topCategory) {
                response += '1. Your top spending category is "' + stats.topCategory + '". Try reducing it by 15% to save ' + Utils.formatCurrency(categoryBreakdown[stats.topCategory] * 0.15) + '/month.\n';
            }

            response += '2. Set aside ' + Utils.formatCurrency(AppState.budget * 0.2) + '/month (20% rule for savings).\n';
            response += '3. Review recurring subscriptions - cancel unused ones.\n';
            response += '4. Use the 50/30/20 rule: 50% needs, 30% wants, 20% savings.\n';

            if (budgetUsedPercent > 80) {
                response += '\n⚠️ You\'re spending ' + budgetUsedPercent + '% of your budget. Consider reviewing discretionary expenses.';
            }

            return response;
        }

        // Specific category query
        const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Education', 'Other'];
        const matchedCategory = categories.find(function(cat) {
            return question.includes(cat.toLowerCase());
        });

        if (matchedCategory) {
            const catExpenses = AppState.expenses.filter(function(e) { return e.category === matchedCategory; });
            const catTotal = catExpenses.reduce(function(sum, e) { return sum + e.amount; }, 0);
            const catCount = catExpenses.length;

            return '📂 ' + matchedCategory + ' Category:\n\n' +
                   'Total spent: ' + Utils.formatCurrency(catTotal) + '\n' +
                   'Number of transactions: ' + catCount + '\n' +
                   'Average per transaction: ' + Utils.formatCurrency(catCount > 0 ? catTotal / catCount : 0) + '\n\n' +
                   (catTotal > AppState.budget * 0.3 ? 'This category is taking over 30% of your budget. Consider optimizing.' : 'Spending looks reasonable for this category.');
        }

        // Date/Time queries
        if (question.includes('today') || question.includes('yesterday') || question.includes('this week') || question.includes('this month')) {
            const now = new Date();
            const todayExpenses = AppState.expenses.filter(function(e) {
                return e.date === now.toISOString().split('T')[0];
            });
            const todayTotal = todayExpenses.reduce(function(sum, e) { return sum + e.amount; }, 0);

            return 'Today\'s expenses: ' + Utils.formatCurrency(todayTotal) + ' (' + todayExpenses.length + ' transactions). ' +
                   (todayTotal > AppState.budget * 0.1 ? 'You\'ve spent over 10% of your daily budget today.' : 'Spending is within limits today.');
        }

        // Help query
        if (question.includes('help') || question.includes('what can you do') || question.includes('features')) {
            return '🤖 I can help you with:\n\n' +
                   '• Check balance: "What\'s my balance?"\n' +
                   '• Track expenses: "How much did I spend on food?"\n' +
                   '• Budget info: "How much budget is left?"\n' +
                   '• Investment tips: "Analyze my portfolio"\n' +
                   '• Market updates: "How is the market doing?"\n' +
                   '• Savings advice: "Give me saving tips"\n' +
                   '• Category analysis: "Show my shopping expenses"\n' +
                   '• Today\'s spending: "What did I spend today?"\n\n' +
                   'Keyboard shortcuts: Ctrl+/ (search), Esc (close chatbot)';
        }

        // Default with helpful提示
        const tips = [
            'Try asking: "What\'s my balance?", "How much did I spend today?", or "Analyze my portfolio"',
            'I can help with budget planning, expense tracking, and investment insights.',
            'Ask me about: balance, expenses, budget, portfolio, market trends, or savings tips.',
            'Try: "How much did I spend on food this month?" or "Give me saving tips"'
        ];
        return tips[Math.floor(Math.random() * tips.length)];
    }
};

// Initialize AI Chatbot on load
document.addEventListener('DOMContentLoaded', function() {
    AIChatbot.init();
    EconomistTeam.renderTeam();
    AIStockManager.renderRecommendations();

    // Refresh recommendations button
    var refreshBtn = document.getElementById('refresh-recs-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            AIStockManager.renderRecommendations();
            Toast.show('Recommendations refreshed!', 'success');
        });
    }
});