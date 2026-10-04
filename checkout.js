'use strict';
const form = document.getElementById('checkout-form');
const pixPanel = document.getElementById('pix-panel');
const cardPanel = document.getElementById('card-panel');
const finishButton = document.getElementById('finish-button');
const status = document.getElementById('checkout-status');
const cardNumber = document.getElementById('card-number');
const cardExpiry = document.getElementById('card-expiry');
const cep = document.getElementById('customer-cep');
const cepResult = document.getElementById('cep-result');
const shippingNote = document.getElementById('shipping-note');
const addressFields = document.getElementById('address-fields');
const selectedMethod = () => document.querySelector('input[name="payment"]:checked').value;

function formatDigits(field, formatter){field.addEventListener('input',()=>field.value=formatter(field.value));}
formatDigits(cep,v=>v.replace(/\D/g,'').slice(0,8).replace(/(\d{5})(\d)/,'$1-$2'));
formatDigits(cardNumber,v=>v.replace(/\D/g,'').slice(0,16).replace(/(\d{4})(?=\d)/g,'$1 '));
formatDigits(cardExpiry,v=>v.replace(/\D/g,'').slice(0,4).replace(/(\d{2})(\d)/,'$1/$2'));
document.getElementById('card-cvv').addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,4));

let lastCepQuery = '';
async function lookupCep(){
  const digits=cep.value.replace(/\D/g,'');
  if(digits.length!==8){cepResult.textContent='';shippingNote.textContent='Informe seu CEP para consultar o endereço.';addressFields.hidden=true;return;}
  lastCepQuery=digits;cepResult.className='cep-result';cepResult.textContent='Consultando endereço…';
  try{
    const response=await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if(!response.ok)throw new Error('CEP inválido');
    const data=await response.json();
    if(lastCepQuery!==digits)return;
    if(data.erro)throw new Error('CEP não encontrado');
    document.getElementById('customer-street').value=data.logradouro||'';
    document.getElementById('customer-neighborhood').value=data.bairro||'';
    document.getElementById('customer-city').value=data.localidade||'';
    document.getElementById('customer-state').value=data.uf||'';
    addressFields.hidden=false;
    document.getElementById('customer-number').focus();
    const address=[data.logradouro,data.bairro,`${data.localidade} - ${data.uf}`].filter(Boolean).join(', ');
    cepResult.textContent=address||`${data.localidade} - ${data.uf}`;
    shippingNote.textContent=`Entrega para ${data.localidade} - ${data.uf}. O valor e prazo do frete serão calculados pela transportadora configurada.`;
  }catch{
    if(lastCepQuery!==digits)return;
    cepResult.className='cep-result error';cepResult.textContent='Não foi possível encontrar este CEP.';
    shippingNote.textContent='Confira o CEP e tente novamente.';addressFields.hidden=true;
  }
}
cep.addEventListener('blur',lookupCep);
cep.addEventListener('input',()=>{if(cep.value.replace(/\D/g,'').length===8)lookupCep();});

function updateMethod(){const card=selectedMethod()==='card';pixPanel.hidden=card;cardPanel.hidden=!card;finishButton.textContent=card?'Continuar com cartão':'Gerar pagamento PIX';}
document.querySelectorAll('input[name="payment"]').forEach(radio=>radio.addEventListener('change',updateMethod));

form.addEventListener('submit',async event=>{
  event.preventDefault();status.className='checkout-status';status.textContent='';
  if(!form.checkValidity()){form.reportValidity();return;}
  const method=selectedMethod();
  const rawCardNumber=method==='card'?cardNumber.value.replace(/\D/g,''):null;
  const payload={
    customerName:document.getElementById('customer-name').value.trim(),
    customerEmail:document.getElementById('customer-email').value.trim(),
    customerCep:cep.value,
    customerStreet:document.getElementById('customer-street').value.trim(),
    customerNumber:document.getElementById('customer-number').value.trim(),
    customerComplement:document.getElementById('customer-complement').value.trim(),
    customerNeighborhood:document.getElementById('customer-neighborhood').value.trim(),
    customerCity:document.getElementById('customer-city').value.trim(),
    customerState:document.getElementById('customer-state').value.trim(),
    paymentMethod:method,
    cardNumber:rawCardNumber,
    cardExpiry:method==='card'?document.getElementById('card-expiry').value.trim():null,
    cardCvv:method==='card'?document.getElementById('card-cvv').value.trim():null
  };
  finishButton.disabled=true;
  try{
    if(location.protocol==='file:'){throw new Error('local-file');}
    const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await response.json();
    if(method==='card'){
      status.classList.add('error');status.textContent='Não foi possível processar o pagamento com cartão. Tente novamente ou escolha outra forma de pagamento.';
    }else if(data.pixEmv){
      status.classList.add('success');
      const pixBox=document.createElement('div');pixBox.className='pix-emv-box';
      const pixLabel=document.createElement('p');pixLabel.textContent='Pix gerado! Copie o código abaixo e pague no seu banco:';
      const pixCode=document.createElement('textarea');pixCode.value=data.pixEmv;pixCode.readOnly=true;pixCode.rows=3;
      const copyBtn=document.createElement('button');copyBtn.type='button';copyBtn.textContent='Copiar código PIX';
      copyBtn.onclick=()=>{navigator.clipboard.writeText(data.pixEmv).then(()=>{copyBtn.textContent='Copiado!';setTimeout(()=>copyBtn.textContent='Copiar código PIX',2000);});};
      pixBox.appendChild(pixLabel);pixBox.appendChild(pixCode);pixBox.appendChild(copyBtn);
      status.textContent='';status.appendChild(pixBox);
    }else{
      status.textContent=data.error||'Erro ao gerar PIX. Tente novamente.';status.classList.add('error');
    }
  }catch{
    if(method==='card'){status.classList.add('error');status.textContent='Não foi possível processar o pagamento com cartão. Tente novamente ou escolha outra forma de pagamento.';}
    else{status.classList.add('error');status.textContent='Erro ao processar pedido. Inicie o servidor e tente novamente.';}
  }finally{finishButton.disabled=false;}
});

updateMethod();
