
type ExpenseProps = {
  Name: string;
  Date: string;
  Value: number;
  Currency: string;
  Status: string;
};



export default function ExpenseComponent(props: ExpenseProps){

    return (
         <tr className="group transition-colors hover:bg-blue-700/5">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                            <span className="material-symbols-outlined text-lg">
                              home_pin
                            </span>
                          </div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {props.Name}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400">
                        {props.Date}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold text-slate-900 dark:text-white">
                        {props.Value}
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-blue-700">
                        R$ {props.Value * 5}
                      </td>
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">
                          {props.Status}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-right">
                        <button className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-800">
                        Mark as Paid
                        </button>
                     </td>
        </tr>
    )
}