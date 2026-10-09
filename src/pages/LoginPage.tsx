import {useRef,useState} from 'react';
import {supabase} from '../lib/supabase';
import {Button} from '../components/ui/button';
import {Input} from '../components/ui/input';
import {Card,CardContent,CardHeader,CardTitle} from '../components/ui/card';
export default function LoginPage(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const busy=useRef(false);
 async function login(event:React.FormEvent){
  event.preventDefault();if(busy.current)return;busy.current=true;setSaving(true);setError('');
  try {const result=await supabase.auth.signInWithPassword({email:email.trim(),password});if(result.error)throw result.error;window.location.href='/dashboard';}
  catch(error){setError(error instanceof Error?error.message:'Sign-in failed. Please try again.');}
  finally{busy.current=false;setSaving(false);}
 }
 return <div className="min-h-screen flex items-center justify-center bg-muted"><Card className="w-full max-w-md"><CardHeader><CardTitle>Owner Dashboard Login</CardTitle></CardHeader><CardContent>
  <form className="space-y-4" onSubmit={login}>
   {error&&<p role="alert" className="text-red-700">{error}</p>}
   <Input aria-label="Email" type="email" autoComplete="username" placeholder="Email" required disabled={saving} value={email} onChange={e=>setEmail(e.target.value)}/>
   <Input aria-label="Password" type="password" autoComplete="current-password" placeholder="Password" required disabled={saving} value={password} onChange={e=>setPassword(e.target.value)}/>
   <Button type="submit" className="w-full" disabled={saving}>{saving?'Signing in...':'Login'}</Button>
  </form>
 </CardContent></Card></div>;
}
