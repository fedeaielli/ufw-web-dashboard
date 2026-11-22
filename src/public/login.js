const password = document.getElementById('password');
const reveal = document.getElementById('reveal');

reveal?.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    reveal.setAttribute('aria-pressed', String(show));
    reveal.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    password.focus({ preventScroll: true });
});

document.querySelector('.login-form')?.addEventListener('submit', (event) => {
    if (!event.currentTarget.checkValidity()) return;
    event.currentTarget.querySelector('.login-submit')?.setAttribute('aria-busy', 'true');
});
