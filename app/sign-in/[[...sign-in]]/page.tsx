import {SignIn} from '@clerk/nextjs';
export default function SignInPage(){return <main className="login-screen"><SignIn fallbackRedirectUrl="/"/></main>;}
