'use server'
import { z } from "zod"
import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

const FormSchema = z.object({
  id: z.string(),
  amount: z.coerce.number().gt(0,{message: 'Please enter an amount greater than $0.'}),
  status:z.enum(['pending','paid']),
  customerId: z.string({
    invalid_type_error: 'Please select a customer'
  })
})

const CreateInvoice = FormSchema.omit({ id: true,date:true})
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

// 创建
export async function createInvoice(pervState:State,formData:FormData) {
  // 验证表单是否正确
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status')
  })
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }
  // 合法后赋值
  const {
    customerId,
    amount,
    status
  } = validatedFields.data
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0]
  try{
    await sql`INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})`
  } catch(error){
    return{
      message: 'Database Error: Failed to Create Invoice.'
    }
  }
  // 清除这个路由下的缓存
  revalidatePath('/dashboard/invoices')
  // 重定向
  redirect('/dashboard/invoices')
}

// 根据id更新
export async function updateInvoice(id:String,pervState:State,formData:FormData) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status')
  })
  if(!validatedFields.success){
    return{
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    }
  }
  const {
    customerId,
    amount,
    status
  } = validatedFields.data
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0]
  try{
    await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}`
  } catch(error){
    return {
      message: 'Database Error: Failed to update Invoice.',
    }
  }
  // 清除这个路由下的缓存
  revalidatePath('/dashboard/invoices')
  // 重定向
  redirect('/dashboard/invoices')
}

export async function deleteInvoice(id:string) {
  try{
    await sql`delete from invoices where id = ${id}`
    return {
      message:'deleted invoice'
    }
  }catch(error){
    return {
      message: 'delete invoice error'
    }
  }
  revalidatePath('/dashboard/invoices')
}

// 登录
export async function authenticate(
  pervState: string | undefined,
  formData: FormData
  ) {
  try{
    await signIn('credentials',formData)
  }catch(error){
    if(error instanceof AuthError){
      switch(error.type){
        case 'CredentialsSignin': return 'Invalid credentials.'
        default: return 'Something went wrong.'
      } 
    }
    throw error
  }
}